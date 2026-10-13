#!/usr/bin/env python3
"""Jev spike, phase 2: measure Jev on the recipe-normalising pipeline stages.

Standard library only (Python 3.10+). Calls the documented HTTP API:
    POST https://api.typesafe.ai/v1/systemone   (docs.typesafe.ai/api)
    Authorization: Bearer <key>

The key is read from the JEV_API_KEY environment variable, or from a
JEV_API_KEY=... line in ./.env next to this script (gitignored). It is never
printed or written to disk.

Usage:
    python3 run_spike.py --dry-run          # build requests, no network, no key needed
    python3 run_spike.py --limit 3          # smoke test on 3 lines + 0 recipes
    python3 run_spike.py                    # full run, writes results/run-<ts>.jsonl
    python3 run_spike.py --workers-ai --model @cf/cloudflare/clef --framing v2 --set dev --repeat 6
                                            # hosted Clef on Workers AI, dev set only; needs
                                            # CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in env

One request per golden line carries every line-level question at once (the
documented "speculative fan-out" pattern): role, compound, kind, one role
question per word token, an ingredient-span pick, plus KB resolution and unit
system where the golden line defines them. One request per recipe carries the
tagging questions.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
API_URL = "https://api.typesafe.ai/v1/systemone"
DEFAULT_MODEL = "jev-1.13.0"  # pinned, per docs.typesafe.ai/models advice on tuned thresholds
PRICE_PER_MTOK_USD = 0.042  # input tokens only; output is free (docs.typesafe.ai/models)
CONF_GATE = 0.8  # confidence at which the pipeline would accept Jev without escalating
GATES = (0.6, 0.8)  # auto-accept gates reported side by side
BANDS = (0.0, 0.5, 0.6, 0.8, 0.95, 1.01)  # calibration bands [lo, hi); phase 2 reported [0,0.5) [0.5,0.8) [0.8,1]
TAXONOMY_DOC = HERE.parents[2] / "spec" / "tag-taxonomy.md"
NONE = "none"

FRACTIONS = "½¼¾⅓⅔⅛⅜⅝⅞"
TOKEN_RE = re.compile(
    rf"\d+(?:[.,]\d+)?(?:/\d+)?|[{FRACTIONS}]|[^\W\d_]+(?:[-'’][^\W\d_]+)*|\S"
)

# ---------------------------------------------------------------- questions

ROLE_CRITERIA = {
    "header": "A section heading inside the ingredient list, such as 'For the dressing:'. Names no ingredient to buy.",
    "ingredient": "Names a food or drink item used in the recipe, with or without an amount.",
    "note": "A remark, tip, serving count or instruction that names no ingredient to buy.",
}
COMPOUND_CRITERIA = {
    "single": "Exactly one ingredient, even if its name contains 'and' (e.g. 'sweet and sour sauce', 'fish and chip seasoning').",
    "compound": "Two or more separate ingredients on one line that would be bought or fetched separately (e.g. 'oil and vinegar').",
    "alternatives": "One ingredient slot with interchangeable options (e.g. 'lard or dripping').",
}
KIND_CRITERIA = {
    "quantified": "An ingredient with an amount, even a vague one ('150g pasta', 'a dash of soy sauce'). It scales and goes on the shopping list.",
    "unquantified": "An ingredient you would buy or get out, but with no amount ('sea salt', 'vegetable oil, for deep-frying').",
    "not_ingredient": "Not something you would buy or get out; it belongs in the method ('a little hot water to loosen').",
}
TOKEN_CRITERIA = {
    "quantity": "How many or how much: a number, fraction, range, or a word like 'a' in 'a dash'.",
    "unit": "Unit or container of the amount: g, ml, tsp, cup, pint, tin, pack, clove, knob, pinch, handful.",
    "size": "Size of each item or container: 'medium', 'small', or the '227g' in '1 x 227g tin'.",
    "ingredient": "Part of the name of the food itself, including words that are part of the product ('smoked paprika', 'minced beef', 'baked beans').",
    "prep": "How to prepare it before use: 'diced', 'grated', 'rinsed', 'zest of'.",
    "note": "Serving, usage or alternative info: 'to season', 'plus more to serve', 'such as Bramley', a parenthetical conversion.",
    "filler": "A connecting word with no meaning of its own, such as 'x' or 'of' between amount and ingredient.",
}
# Framing v2 (phase 2 retry): the token is marked inside the line instead of addressed by
# index (Jev is weak at counting), and the criteria say where numbers inside a size or a
# conversion belong. Examples avoid golden-set lines.
TOKEN_CRITERIA_V2 = {
    "quantity": "The main amount only: a number, fraction, range, or a word like 'a' in 'a dash'. Not a number inside a pack size, a conversion or a note.",
    "unit": "Unit or container of the main amount: g, ml, tsp, cup, pint, tin, pack, clove, knob, pinch, handful. Not the unit of a pack size or a conversion.",
    "size": "Size of each item or container: 'medium', 'small', or both the '227' and the 'g' in '1 x 227g tin'.",
    "ingredient": "Part of the shopping name of the food, including words that pick out the product ('smoked paprika', 'frozen spinach', 'salted butter', 'caster sugar').",
    "prep": "How to prepare it before use: 'diced', 'grated', 'rinsed', or the part used, as in 'zest of' or 'juice of'.",
    "note": "Serving, usage or alternative info: 'to season', 'plus more to serve', 'such as Bramley', or a conversion or second amount with its number and unit (the '8' and 'oz' in '225g/8oz', '(1 cup)'), or liquid to dissolve it in.",
    "filler": "A connecting word with no meaning of its own, such as 'x' or 'of' between amount and ingredient.",
}
SPAN_INSTRUCTIONS_V2 = ("Which span of `line` is the shopping name of the ingredient, without amount, unit, pack size, "
                        "preparation or notes? Keep words that pick out the product, as in 'smoked paprika', "
                        "'frozen spinach' or 'caster sugar'.")
CARB_LABEL_V2 = {"grains": "grains other than rice, such as couscous, bulgur or quinoa"}
FRAMING = "v1"
TAG_SCHEME = "phase2"  # phase2 = TAXONOMY below; v01 = docs/spec/tag-taxonomy.md

UNIT_SYSTEM_CRITERIA = {
    "us_customary": "US measures: cup is 240ml, pint is 473ml. Typical of American sites and wording (cilantro, confectioners' sugar).",
    "uk_imperial": "British imperial measures: pint is 568ml. Typical of British sites and wording.",
    "metric_cup": "Metric cup of 250ml, used in Australia, New Zealand and some modern UK recipes.",
    "not_applicable": "The line has no cup or pint measure.",
}

TAXONOMY = {
    "cuisine": ["british", "irish", "french", "italian", "spanish", "greek", "middle_eastern", "north_african",
                "indian", "thai", "chinese", "japanese", "korean", "vietnamese", "mexican", "american",
                "caribbean", "other"],
    "meal_type": ["breakfast", "lunch", "dinner", "side", "dessert", "snack"],
    "effort": ["easy", "medium", "hard"],
    # multi-label dimensions: one Noul per option
    "protein": ["chicken", "beef", "pork", "lamb", "fish", "seafood", "egg", "tofu", "pulses", "cheese"],
    "carb_base": ["rice", "pasta", "noodles", "potato", "bread", "grains"],
    "method": ["bake", "roast", "grill", "fry", "simmer", "slow_cook", "one_pot", "no_cook", "bbq"],
}
MULTI_LABEL = ("protein", "carb_base", "method")


def choice(instructions, criteria):
    return {"type": "choice", "instructions": instructions, "criteria": criteria}


def noul(instructions):
    return {"type": "noul", "instructions": instructions}


def tokenize(line: str) -> list[tuple[str, int, int]]:
    return [(m.group(), m.start(), m.end()) for m in TOKEN_RE.finditer(line)]


def is_word(tok: str) -> bool:
    return any(ch.isalnum() for ch in tok)


def build_line_request(item: dict) -> tuple[dict, dict]:
    line = item["line"]
    toks = tokenize(line)
    words = [(i, t) for i, t in enumerate(toks) if is_word(t[0])]
    state = {"line": line} if FRAMING == "v2" else {"line": line, "tokens": [t[0] for t in toks]}
    q: dict[str, dict] = {
        "role": choice("What kind of line is `line` in a recipe's ingredient list?", ROLE_CRITERIA),
        "compound": choice("How many separate ingredients does `line` name?", COMPOUND_CRITERIA),
        "kind": choice("Would you buy or get out the item in `line`, and does it state an amount?", KIND_CRITERIA),
    }
    for i, (tok, a, b) in words:
        if FRAMING == "v2":
            marked = f"{line[:a]}«{tok}»{line[b:]}"
            q[f"tok_{i}"] = choice(f"In the ingredient line \"{marked}\", which part is the marked word «{tok}»?",
                                   TOKEN_CRITERIA_V2)
        else:
            q[f"tok_{i}"] = choice(f"In `line`, which part is `tokens[{i}]` (the word \"{tok}\")?", TOKEN_CRITERIA)

    # Span pick: every contiguous run of word tokens, as a verbatim slice of the line.
    spans: list[str] = []
    for a in range(len(words)):
        for b in range(a, len(words)):
            s = line[words[a][1][1]:words[b][1][2]]
            if s not in spans:
                spans.append(s)
    spans = spans[:254]
    q["ingredient_span"] = choice(
        SPAN_INSTRUCTIONS_V2 if FRAMING == "v2" else
        "Which span of `line` is the name of the ingredient itself, without amount, unit, size, preparation or notes?",
        {**{s: None for s in spans}, NONE: "The line names no ingredient."},
    )

    if "resolve" in item:
        crit = dict(item["resolve"]["candidates"])
        crit[NONE] = "None of these entries is the ingredient in the line."
        q["resolve"] = choice("Which knowledge-base entry is the ingredient named in `line`?", crit)
    if "unit_system" in item:
        state["source_site"] = item["source"]
        q["unit_system"] = choice(
            "Which measurement system do the cup or pint measures in `line` use, given `source_site`?",
            UNIT_SYSTEM_CRITERIA,
        )
    meta = {"tokens": toks, "word_idx": [i for i, _ in words], "span_options": len(spans) + 1}
    return {"state": state, "questions": q}, meta


def build_recipe_request_phase2(rec: dict) -> dict:
    state = {"title": rec["title"], "ingredients": rec["ingredients"], "method": rec["method_summary"]}
    q = {
        "cuisine": choice("Which cuisine is this recipe?", {c: None for c in TAXONOMY["cuisine"]}),
        "meal_type": choice("Which meal is this recipe most often eaten as?", {c: None for c in TAXONOMY["meal_type"]}),
        "effort": choice("How much hands-on effort does this recipe take for a home cook?",
                         {"easy": "Little hands-on work", "medium": "Some attention and several steps",
                          "hard": "Technique-heavy or long active time"}),
    }
    for dim in MULTI_LABEL:
        for opt in TAXONOMY[dim]:
            label = CARB_LABEL_V2.get(opt, opt) if (FRAMING == "v2" and dim == "carb_base") else opt.replace("_", " ")
            label = label.replace("_", " ")
            ask = {"protein": f"Is {label} a main protein of this recipe?",
                   "carb_base": f"Is {label} the main carbohydrate base of this meal, as cooked or served?",
                   "method": f"Does the recipe use the cooking method '{label}'?"}[dim]
            q[f"{dim}__{opt}"] = noul(ask)
    return {"state": state, "questions": q}


# ---------------------------------------------------------------- transport


def load_key() -> str | None:
    key = os.environ.get("JEV_API_KEY")
    if key:
        return key.strip()
    env = HERE / ".env"
    if env.exists():
        for raw in env.read_text().splitlines():
            k, sep, v = raw.strip().partition("=")
            if sep and k.strip() == "JEV_API_KEY":
                return v.strip().strip('"').strip("'") or None
    return None


HTTP_TIMEOUT = 30
BODY_MODEL = None  # model name sent in the body when it differs from --model (Workers AI: "clef")
ENVELOPES: list[list[str]] = []  # top-level keys of each raw response, before unwrapping
SECRETS: list[str] = []  # values scrubbed from anything printed or written


def redact(text: str) -> str:
    for v in SECRETS:
        if v:
            text = text.replace(v, "<redacted>")
    return text


def workers_ai_setup(model_id: str) -> str:
    """Build the Workers AI URL from env. Neither value is ever printed or written."""
    acct, tok = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip(), os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not acct or not tok:
        sys.exit("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set in env. Nothing was called.")
    SECRETS.extend([acct, tok])
    return f"https://api.cloudflare.com/client/v4/accounts/{acct}/ai/run/{model_id}"


def unwrap(data: dict) -> dict:
    """Workers AI may wrap the SystemOne body in {result, success, errors, messages}."""
    ENVELOPES.append(sorted(data.keys()))
    if isinstance(data, dict) and "result" in data and "answers" not in data:
        return data["result"]
    return data


def call(payload: dict, key: str | None, model: str, max_retries: int = 5) -> tuple[dict, float]:
    body = json.dumps({**payload, "model": BODY_MODEL or model}).encode()
    for attempt in range(max_retries + 1):
        headers = {"Content-Type": "application/json"}
        if key:
            headers["Authorization"] = f"Bearer {key}"
        req = urllib.request.Request(API_URL, data=body, method="POST", headers=headers)
        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as r:
                data = json.loads(r.read())
            return unwrap(data), time.perf_counter() - t0
        except urllib.error.HTTPError as e:
            detail = redact(e.read().decode(errors="replace")[:500])
            if e.code in (429, 529) and attempt < max_retries:
                wait = float(e.headers.get("retry-after") or 2 ** attempt)
                print(f"  {e.code}, retrying in {wait:.1f}s", file=sys.stderr)
                time.sleep(wait)
                continue
            if e.code in (401, 403):
                sys.exit(f"HTTP {e.code}: credentials were rejected (values not shown).")
            raise RuntimeError(f"HTTP {e.code}: {detail}") from None
    raise RuntimeError("retries exhausted")


# ---------------------------------------------------------------- scoring

# Providers fill `confidence` differently from the same probabilities (found 2026-10-13):
#   Jev (docs.typesafe.ai/confidence.md): (p_max - 1/n) / (1 - 1/n)
#   clef_mlx serve (laptop):              p_max
#   Workers AI Clef:                      (n * sum(p^2) - 1) / (n - 1), a normalised Gini concentration
# Comparing gates across providers therefore needs one definition computed here from `probabilities`.
CONF_DEF = "jev"


def conf(ans: dict) -> float | None:
    probs = ans.get("probabilities")
    if CONF_DEF == "provider" or not probs:
        return ans.get("confidence")
    p, n = list(probs.values()), len(probs)
    if CONF_DEF == "top":
        return max(p)
    if CONF_DEF == "gini":
        return (n * sum(x * x for x in p) - 1) / (n - 1)
    return (max(p) - 1 / n) / (1 - 1 / n)  # jev


CORE_FIELDS = ("quantity", "unit", "size", "ingredient")


def norm(s: str | None) -> str | None:
    if s is None:
        return None
    return re.sub(rf"[^\w{FRACTIONS}]", "", s.lower()) or None


def matches(got, expected) -> bool:
    options = expected if isinstance(expected, list) else [expected]
    return norm(got) in {norm(o) for o in options}


def assemble_fields(meta: dict, answers: dict) -> dict:
    """Group word tokens by label. A filler between two words of the same label is part of
    that field ('drained and rinsed', 'plus extra for dusting'), so it joins it."""
    idx = meta["word_idx"]
    labels = [answers[f"tok_{i}"]["choice"] for i in idx]
    for j, lab in enumerate(labels):
        if lab == "filler":
            left = next((labels[k] for k in range(j - 1, -1, -1) if labels[k] != "filler"), None)
            right = next((labels[k] for k in range(j + 1, len(labels)) if labels[k] != "filler"), None)
            if left is not None and left == right:
                labels[j] = left
    by_label: dict[str, list[str]] = {k: [] for k in TOKEN_CRITERIA}
    for i, lab in zip(idx, labels):
        by_label[lab].append(meta["tokens"][i][0])
    return {k: (" ".join(v) if v else None) for k, v in by_label.items() if k != "filler"}


def score_line(item: dict, meta: dict, answers: dict) -> list[dict]:
    rows = []

    def add(probe, got, expected, conf):
        rows.append({"probe": probe, "got": got, "expected": expected, "ok": matches(got, expected), "conf": conf})

    a = answers
    add("segment.role", a["role"]["choice"], item["role"], conf(a["role"]))
    if item["role"] != "ingredient":
        return rows
    add("segment.compound", a["compound"]["choice"], item["compound"], conf(a["compound"]))
    add("classify.kind", a["kind"]["choice"], item["kind"], conf(a["kind"]))
    # Lines that are not ingredients never reach extraction, so their fields are not scored.
    if item["compound"] == "single" and item["kind"] != "not_ingredient":
        fields = assemble_fields(meta, a)
        tok_confs = [conf(a[f"tok_{i}"]) for i in meta["word_idx"]]
        min_conf = min(tok_confs) if tok_confs else None
        all_ok = True
        for f, exp in item["fields"].items():
            ok = matches(fields[f], exp)
            all_ok &= ok
            rows.append({"probe": f"extract.tokens.{f}", "got": fields[f], "expected": exp, "ok": ok, "conf": min_conf})
        rows.append({"probe": "extract.tokens.ALL_FIELDS", "got": fields, "expected": item["fields"], "ok": all_ok, "conf": min_conf})
        # Core fields feed scaling and shopping lists; prep and note are display only.
        core_ok = all(matches(fields[f], item["fields"][f]) for f in CORE_FIELDS)
        rows.append({"probe": "extract.tokens.CORE_FIELDS", "got": {f: fields[f] for f in CORE_FIELDS},
                     "expected": {f: item["fields"][f] for f in CORE_FIELDS}, "ok": core_ok, "conf": min_conf})
        span = a["ingredient_span"]["choice"]
        add("extract.span.ingredient", None if span == NONE else span, item["fields"]["ingredient"], conf(a["ingredient_span"]))
    if "resolve" in item:
        add("resolve.ingredient", a["resolve"]["choice"], item["resolve"]["expected"], conf(a["resolve"]))
    if "unit_system" in item:
        add("resolve.unit_system", a["unit_system"]["choice"], item["unit_system"], conf(a["unit_system"]))
    return rows


def score_recipe_phase2(rec: dict, answers: dict) -> list[dict]:
    rows = []
    for dim in ("cuisine", "meal_type", "effort"):
        got, exp = answers[dim]["choice"], rec["expected"][dim]
        rows.append({"probe": f"tag.{dim}", "got": got, "expected": exp, "ok": matches(got, exp), "conf": conf(answers[dim])})
    for dim in MULTI_LABEL:
        got = sorted(o for o in TAXONOMY[dim] if answers[f"{dim}__{o}"]["noul"] >= 0.5)
        exp = sorted(rec["expected"][dim])
        optional = set(rec["expected"].get("optional", {}).get(dim, []))
        ok = set(exp) <= set(got) <= set(exp) | optional
        rows.append({"probe": f"tag.{dim}(multi)", "got": got, "expected": exp, "ok": ok, "conf": None,
                     "nouls": {o: answers[f"{dim}__{o}"]["noul"] for o in TAXONOMY[dim]}})
    return rows


# ---------------------------------------------------------------- V0.1 tag taxonomy (--taxonomy v01)
# Dimensions, questions and definitions are parsed from docs/spec/tag-taxonomy.md, so the text Jev is
# given and the text the golden set is graded against cannot drift apart (taxonomy principle 2).

V01_DIMS = ("meal", "cuisine", "protein", "carb", "method", "effort", "equipment")  # diet is derived, not asked


def load_taxonomy_v01() -> dict:
    dims: dict[str, dict] = {}
    cur = None
    for raw in TAXONOMY_DOC.read_text().splitlines():
        line = raw.strip()
        m = re.match(r"^### .*\(`(\w+)`\): (single|multi)", line)
        if m:
            cur = dims.setdefault(m.group(1), {"kind": m.group(2), "question": "", "values": {}})
            continue
        if line.startswith("## "):
            cur = None
        if cur is None:
            continue
        if line.startswith("Question:") or line.startswith("Rule:"):
            text = re.sub(r'^"([^"]*)"', r"\1", line.split(":", 1)[1].strip())
            cur["question"] = (cur["question"] + " " + text).strip()
            continue
        m = re.match(r"^\| `(\w+)` \| ([^|]+) \| (.+) \|$", line)
        if m:
            cur["values"][m.group(1)] = {"label": m.group(2).strip(), "definition": m.group(3).strip()}
    missing = [d for d in V01_DIMS if not dims.get(d, {}).get("values")]
    if missing:
        sys.exit(f"tag taxonomy parse failed for {missing} in {TAXONOMY_DOC}")
    return {d: dims[d] for d in V01_DIMS}


def build_recipe_request_v01(rec: dict) -> dict:
    tax = load_taxonomy_v01()
    state = {"title": rec["title"], "ingredients": rec["ingredients"], "method": rec["method_summary"]}
    q = {}
    for dim, spec in tax.items():
        if spec["kind"] == "single":
            criteria = {v: d["definition"] for v, d in spec["values"].items()}
            criteria.setdefault(NONE, "None of the other values fits, or it cannot be told from the recipe.")
            q[dim] = choice(spec["question"], criteria)
        else:
            for v, d in spec["values"].items():
                ask = re.sub(r"\bX\b|…", d["label"].lower(), spec["question"])
                q[f"{dim}__{v}"] = noul(f"{ask} '{d['label']}' means: {d['definition']}")
    return {"state": state, "questions": q}


def score_recipe_v01(rec: dict, answers: dict) -> list[dict]:
    tax = load_taxonomy_v01()
    exp_all = rec["expected_v01"]
    rows = []
    for dim, spec in tax.items():
        exp = exp_all[dim]
        if spec["kind"] == "single":
            got = answers[dim]["choice"]
            near = norm(got) in {norm(o) for o in exp_all.get("near", {}).get(dim, [])}
            rows.append({"probe": f"tag.{dim}", "got": got, "expected": exp, "ok": matches(got, exp),
                         "near": near, "conf": conf(answers[dim])})
        else:
            values = list(spec["values"])
            got = sorted(v for v in values if answers[f"{dim}__{v}"]["noul"] >= 0.5)
            optional = set(exp_all.get("optional", {}).get(dim, []))
            ok = set(exp) <= set(got) <= set(exp) | optional
            rows.append({"probe": f"tag.{dim}(multi)", "got": got, "expected": sorted(exp), "ok": ok, "conf": None,
                         "nouls": {v: answers[f"{dim}__{v}"]["noul"] for v in values}})
    return rows


def build_recipe_request(rec: dict) -> dict:
    return build_recipe_request_v01(rec) if TAG_SCHEME == "v01" else build_recipe_request_phase2(rec)


def score_recipe(rec: dict, answers: dict) -> list[dict]:
    return score_recipe_v01(rec, answers) if TAG_SCHEME == "v01" else score_recipe_phase2(rec, answers)


def summarise(rows: list[dict], latencies: list[float], input_tokens: int) -> None:
    probes: dict[str, list[dict]] = {}
    for r in rows:
        probes.setdefault(r["probe"], []).append(r)
    gate_hdr = "".join(f" {'acc@' + str(g):>8} {'auto@' + str(g):>8}" for g in GATES)
    print(f"\n{'probe':34} {'n':>3} {'acc':>6}{gate_hdr} {'near':>4}")
    for p, rs in probes.items():
        acc = sum(r["ok"] for r in rs) / len(rs)
        cols = ""
        for g in GATES:
            gated = [r for r in rs if r["conf"] is not None and r["conf"] >= g]
            gacc = f"{sum(r['ok'] for r in gated) / len(gated):.2f}" if gated else "-"
            cov = f"{len(gated) / len(rs):.2f}" if any(r["conf"] is not None for r in rs) else "-"
            cols += f" {gacc:>8} {cov:>8}"
        near = sum(1 for r in rs if not r["ok"] and r.get("near"))
        print(f"{p:34} {len(rs):>3} {acc:>6.2f}{cols} {near if near else '':>4}")
    print("\n(acc@g = accuracy of answers with confidence >= g; auto@g = share auto-accepted at gate g;"
          " near = wrong answers that were a listed near miss)")
    print("\ncalibration (answers with a confidence, by stage):")
    stages: dict[str, list[dict]] = {}
    for r in rows:
        if r["conf"] is not None:
            stages.setdefault(r["probe"].split(".")[0], []).append(r)
    labels = [f"[{lo:g},{min(hi, 1.0):g}{']' if hi > 1 else ')'}" for lo, hi in zip(BANDS, BANDS[1:])]
    print(f"{'stage':10}" + "".join(f" {l:>14}" for l in labels))
    for st, rs in stages.items():
        cells = ""
        for lo, hi in zip(BANDS, BANDS[1:]):
            b = [r for r in rs if lo <= r["conf"] < hi]
            cell = f"{sum(r['ok'] for r in b) / len(b):.2f} n={len(b)}" if b else "-"
            cells += f" {cell:>14}"
        print(f"{st:10}{cells}")
    if latencies:
        lat = sorted(latencies)
        p95 = lat[min(len(lat) - 1, int(round(0.95 * (len(lat) - 1))))]
        print(f"requests={len(lat)} latency p50={statistics.median(lat) * 1000:.0f}ms p95={p95 * 1000:.0f}ms max={lat[-1] * 1000:.0f}ms")
    print(f"input_tokens={input_tokens} est_cost=${input_tokens / 1e6 * PRICE_PER_MTOK_USD:.5f}")
    failures = [r for r in rows if not r["ok"]]
    if failures:
        print("\nfailures:")
        for r in failures:
            print(f"  {r.get('id', '?'):4} {r['probe']:30} got={r['got']!r} expected={r['expected']!r} conf={r['conf']}")


# ---------------------------------------------------------------- main


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="build requests and print a sample; no network")
    ap.add_argument("--limit", type=int, help="only the first N lines (and no recipes unless --recipes)")
    ap.add_argument("--recipes", action="store_true", help="with --limit, still run the recipe tagging probe")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--framing", choices=("v1", "v2"), default="v1", help="question framing (v2 = phase 2 retry)")
    ap.add_argument("--rescore", type=Path, help="re-score an existing results file offline; no network")
    ap.add_argument("--taxonomy", choices=("phase2", "v01"), default="phase2",
                    help="recipe tagging vocabulary: phase2 = the spike's own; v01 = docs/spec/tag-taxonomy.md (expected_v01)")
    ap.add_argument("--set", choices=("all", "dev", "heldout"), default="all",
                    help="dev = L01-L44 and R01-R03 (v2 was tuned on these); heldout = lines added 2026-10-13")
    ap.add_argument("--api-url", help="SystemOne-compatible endpoint other than Jev (e.g. a local Clef server); no key sent")
    ap.add_argument("--timeout", type=float, default=30, help="HTTP timeout in seconds (local laptop inference is slow)")
    ap.add_argument("--workers-ai", action="store_true",
                    help="call Cloudflare Workers AI at /ai/run/<--model> (e.g. @cf/cloudflare/clef); reads "
                         "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN from env and never prints them")
    ap.add_argument("--confidence", choices=("jev", "top", "gini", "provider"), default="jev",
                    help="how gates read confidence: jev = (p_max-1/n)/(1-1/n) from probabilities (default, "
                         "comparable across providers); top = p_max; gini = Workers AI's; provider = as returned")
    ap.add_argument("--repeat", type=int, default=0, help="after the run, re-send the first N line requests and compare answers")
    args = ap.parse_args()
    global FRAMING, TAG_SCHEME, API_URL, HTTP_TIMEOUT, BODY_MODEL, CONF_DEF
    HTTP_TIMEOUT = args.timeout
    CONF_DEF = args.confidence
    if args.workers_ai:
        if args.api_url:
            sys.exit("--workers-ai and --api-url are exclusive.")
        if args.set != "dev":
            sys.exit("--workers-ai requires --set dev (held-out is off limits for this spike).")
        if not args.dry_run and not args.rescore:
            args.api_url = workers_ai_setup(args.model)
        BODY_MODEL = args.model.rsplit("/", 1)[-1]
    if args.api_url:
        # Spike guard: a non-Jev model may only ever see the dev set. The held-out labels await
        # the owner's blind check, and seeing another model's results first would spoil it.
        if args.set != "dev":
            sys.exit("--api-url requires --set dev (held-out is off limits for this spike).")
        API_URL = args.api_url
    FRAMING = args.framing
    TAG_SCHEME = args.taxonomy

    golden = json.loads((HERE / "golden.json").read_text())
    if args.set != "all":
        for k in ("lines", "recipes"):
            golden[k] = [it for it in golden[k] if it.get("set", "dev") == args.set]
    if args.api_url:
        assert all(it.get("set", "dev") == "dev" for k in ("lines", "recipes") for it in golden[k])
    lines = golden["lines"][: args.limit] if args.limit else golden["lines"]
    recipes = golden["recipes"] if (args.recipes or not args.limit) else []
    line_reqs = [(item, *build_line_request(item)) for item in lines]
    recipe_reqs = [(rec, build_recipe_request(rec)) for rec in recipes]

    if args.rescore:
        by_id = {it["id"]: it for it in golden["lines"] + golden["recipes"]}
        rows, latencies, tokens = [], [], 0
        for raw in args.rescore.read_text().splitlines():
            rec = json.loads(raw)
            item, data = by_id[rec["id"]], rec["response"]
            latencies.append(rec["latency_s"])
            tokens += data.get("usage", {}).get("input_tokens", 0)
            if "line" in item:
                scored = score_line(item, build_line_request(item)[1], data["answers"])
            else:
                scored = score_recipe(item, data["answers"])
            rows += [{**r, "id": rec["id"]} for r in scored]
        print(f"rescored {args.rescore.name}")
        summarise(rows, latencies, tokens)
        return

    if args.dry_run:
        n_q = [len(p["questions"]) for _, p, _ in line_reqs]
        chars = sum(len(json.dumps(p)) for _, p, _ in line_reqs) + sum(len(json.dumps(p)) for _, p in recipe_reqs)
        print(f"lines={len(line_reqs)} recipes={len(recipe_reqs)} questions/line min={min(n_q)} max={max(n_q)}")
        print(f"max span options={max(m['span_options'] for _, _, m in line_reqs)} (limit 255)")
        print(f"rough input tokens ~{chars // 4} -> est cost ~${chars / 4 / 1e6 * PRICE_PER_MTOK_USD:.5f}")
        sample = line_reqs[1][1] if len(line_reqs) > 1 else line_reqs[0][1]
        print("sample request (questions truncated):")
        print(json.dumps({**sample, "model": args.model, "questions": dict(list(sample["questions"].items())[:4])}, ensure_ascii=False, indent=2))
        print(f"JEV_API_KEY set: {load_key() is not None}")
        return

    if args.workers_ai:
        key = os.environ["CLOUDFLARE_API_TOKEN"].strip()
    else:
        key = None if args.api_url else load_key()
    if not key and not args.api_url:
        sys.exit("JEV_API_KEY is not set (env var or research/jev-spike/.env). Nothing was called.")

    out_dir = HERE / "results"
    out_dir.mkdir(exist_ok=True)
    tag = re.sub(r"[^\w.-]", "_", args.model)
    out_path = out_dir / f"run-{datetime.now():%Y%m%d-%H%M%S}-{tag}-{args.set}-{FRAMING}-{TAG_SCHEME}.jsonl"
    rows, latencies, tokens = [], [], 0
    with out_path.open("w") as out:
        for item, payload, meta in line_reqs:
            data, dt = call(payload, key, args.model)
            latencies.append(dt)
            tokens += data.get("usage", {}).get("input_tokens", 0)
            scored = [{**r, "id": item["id"]} for r in score_line(item, meta, data["answers"])]
            rows += scored
            out.write(json.dumps({"id": item["id"], "line": item["line"], "latency_s": dt, "response": data, "scored": scored}, ensure_ascii=False) + "\n")
            print(f"{item['id']} {dt * 1000:5.0f}ms {'ok ' if all(r['ok'] for r in scored) else 'ERR'} {item['line']}")
        for rec, payload in recipe_reqs:
            data, dt = call(payload, key, args.model)
            latencies.append(dt)
            tokens += data.get("usage", {}).get("input_tokens", 0)
            scored = [{**r, "id": rec["id"]} for r in score_recipe(rec, data["answers"])]
            rows += scored
            out.write(json.dumps({"id": rec["id"], "latency_s": dt, "response": data, "scored": scored}, ensure_ascii=False) + "\n")
            print(f"{rec['id']} {dt * 1000:5.0f}ms {rec['title']}")
    print(f"\nmodel={args.model} framing={FRAMING} taxonomy={TAG_SCHEME} raw results: {out_path.name}")
    if ENVELOPES:
        shapes = sorted({",".join(k) for k in ENVELOPES})
        print(f"response top-level keys seen: {shapes}")
    summarise(rows, latencies, tokens)
    if args.repeat:
        # Determinism: re-send identical requests and compare every answer exactly.
        print(f"\nrepeat check on first {args.repeat} line requests:")
        first = {}
        for raw in out_path.read_text().splitlines():
            rec = json.loads(raw)
            first[rec["id"]] = rec["response"]["answers"]
        for item, payload, meta in line_reqs[: args.repeat]:
            data, dt = call(payload, key, args.model)
            a, b = first[item["id"]], data["answers"]
            same_choice = sum(1 for q in a if json.dumps(a[q].get("choice", a[q].get("answer")), sort_keys=True)
                              == json.dumps(b.get(q, {}).get("choice", b.get(q, {}).get("answer")), sort_keys=True))
            identical = sum(1 for q in a if a[q] == b.get(q))
            maxdiff = 0.0
            for q in a:
                ca, cb = a[q].get("confidence"), b.get(q, {}).get("confidence")
                if isinstance(ca, (int, float)) and isinstance(cb, (int, float)):
                    maxdiff = max(maxdiff, abs(ca - cb))
            print(f"  {item['id']} {dt * 1000:5.0f}ms questions={len(a)} same_top={same_choice} byte_identical={identical} max_conf_delta={maxdiff:.4f}")


if __name__ == "__main__":
    main()
