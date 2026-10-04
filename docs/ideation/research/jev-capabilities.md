# Jev capabilities for the recipe engine

Date: 2026-09-25. Phase 1 of the Jev spike (desk research, no API calls). Model at time
of writing: `jev-1.13.0`, the target of the `jev-latest` alias. Phase 2 (hands-on, below)
ran on 2026-10-04.

## Phase 2 results (2026-10-04)

I ran `jev-spike/run_spike.py` against the golden set (44 lines, 3 recipes, one request
per line or recipe, model pinned to `jev-1.13.0`). There were three runs: a 3-line smoke
test, a full run with the original framing (v1) and a full run with one improved framing
(v2). v2 changes only the token-labelling question, the span-pick instruction and the
"grains" label. Raw output is in `jev-spike/results/`. `python3 run_spike.py --rescore
<file>` re-scores a results file offline. I also fixed the scorer, because it dropped
connecting words such as "and" and "for" from multi-word fields. With that fix, v1's
all-fields figure rises from 0.51 to 0.59. Every v1 number below uses the fixed scorer.

| Stage (probe) | n | v1 acc | v2 acc | v2 acc at conf >= 0.8 | v2 share auto-accepted |
|---|---|---|---|---|---|
| Segment: role | 44 | 0.98 | 1.00 | 1.00 | 0.98 |
| Segment: single / compound / alternatives | 39 | 1.00 | 1.00 | 1.00 | 0.97 |
| Classify kind | 39 | 0.97 | 0.95 | 1.00 | 0.92 |
| Extract per token, all six fields right | 37 | 0.59 | 0.92 | 1.00 | 0.59 (0.76 at a 0.6 gate, still 0 wrong) |
| Extract: ingredient span pick | 37 | 0.92 | 0.95 | 1.00 | 0.78 |
| Resolve ingredient to KB (4 candidates + none) | 18 | 0.94 | 1.00 | 1.00 | 0.78 |
| Resolve unit system | 7 | 1.00 | 1.00 | 1.00 | 1.00 |
| Tags: cuisine / meal type / effort | 3 each | 1.00 / 1.00 / 1.00 | 0.67 / 1.00 / 1.00 | 1.00 | 0.67 / 1.00 / 0.67 |
| Tags: protein / carb base / method (Nouls at 0.5) | 3 each | 1.00 / 0.67 / 0.67 | 1.00 / 1.00 / 0.67 | n/a | n/a |

Per-field token accuracy rose for every field from v1 to v2 (quantity 0.84 to 0.95, unit
0.78 to 0.97, size 0.92 to 1.00, ingredient 0.89 to 0.97, prep 0.86 to 0.97, note 0.84 to
0.95). The extraction gate uses the lowest token confidence on the line, which is strict.

**Calibration.** Confidence tracks correctness well. In v2, answers in the [0, 0.5) band
were right 67% of the time (n=15) and answers in [0.5, 0.8) were right 84% of the time
(n=19). Every answer at 0.8 or above was right (n=196). v1 was similar, with 37%, 68%,
95% and 99% across the four bands. v1 had two confident misses: L27 at 0.96 and L39 at
0.86. v2 had none.

**Auto-accept vs escalate (v2, gate 0.8).** Segmentation, kind, unit system and meal type
auto-accept 92-100% of items with no errors, and the escalated items are mostly the
judgement calls below. For extraction, 22 of 37 lines clear the gate. The 15 escalated
lines include 3 real errors and 12 lines that were already right, so a 0.6 gate looks
safe on this set (28 of 37, 0 wrong). KB resolution auto-accepts 14 of 18, and all 4
escalated answers were in fact right.

**Operational.** Choices were identical across repeat runs (32 of 32 questions), with
confidence drift of up to 0.05. Latency for 5-18 questions per request was p50 278 ms and
p95 331 ms, with a maximum of 444 ms, so it stays under the 500 ms claim. Input averaged
about 2.7k tokens per line request in v1 and 3.2k in v2 (maximum 7.4k), and about 1.1k
per recipe. That is roughly 1.5x the dry-run estimate. Output tokens are free. Unicode
option keys ("1½", "purée") worked, and 18 questions in one request hit no cap. One surprise is that removing the `tokens` array from
the state changed answers to questions whose wording had not changed (L23, L08, R02). So
thresholds must be tuned on the exact request template that ships.

**Misses, classified.** The confidence shown is Jev's, and "esc" means the answer fell
below 0.8 and would have been escalated.
- *Framing problems in the script, all fixed by v2.* The tokenizer splits "400g" into
  "400" and "g", and the criteria did not say where the numbers of a size or a conversion
  belong. That produced misses on L02, L04, L26, L29 (sizes, 0.48-0.75 esc), L13 and L38
  (parentheticals, 0.46-0.47 esc) and L27 "250g/9oz" (9 and oz read as a second amount,
  0.96, a confident miss). Separately, R01 got "grains" at 0.89 next to "rice", because
  the label overlapped with rice.
- *Jev errors.* In v1: L09 and L17 tagged "ground" and "frozen" as prep (0.44 and 0.52
  esc); L30 and L31 tagged "Juice" as part of the ingredient (0.79 and 0.37 esc); spans
  for L02, L38 and L39 were "tomatoes" (0.76 esc), "butter" (0.60 esc) and "sugar" (0.86,
  a confident miss). In both runs, L40 read "500ml boiling water" as the amount and the
  ingredient (0.40 and 0.51 esc). In v2: L28 tagged "Piper" as ingredient (0.49 esc); the
  L11 span was "fat garlic cloves" (0.44 esc); and the L41 span was "freshly ground black
  pepper" (0.58 esc), because the v2 instruction to keep product words over-reached.
- *Debatable golden judgement calls, for review.* L07 "a splash of water" came back as
  quantified, not not_ingredient (0.31 and 0.45 esc). L44 "enough cold water to cover"
  came back as quantified (0.04 esc), with quantity "enough" and prep "cold". L23
  "Marinade" was ingredient in v1 (0.32 esc) and header in v2. L08 butter resolved to none
  and then unsalted (0.30 and 0.29 esc). In v1, L26 gave "coriander leaves" plus prep
  "picked" (0.54 esc), and L37 gave quantity "1 heaped" (0.39 esc). R02 shakshuka came
  back north_african (0.52 esc). R03 came back one_pot (0.79-0.80 as a Noul) where the
  golden set expects fry (0.28-0.29).

**Proposed golden-set changes (not applied).** These are for the user to decide.
1. L08: add a generic `butter` candidate and expect it. Neither salted nor unsalted is
   right for "a knob of butter".
2. R02 cuisine: accept `middle_eastern` or `north_african`, since shakshuka is Maghrebi in
   origin.
3. R03 method: decide whether a slow cooker counts as `one_pot` and whether browning
   counts as `fry`. I would expect `slow_cook` + `one_pot` and leave `fry` optional.
4. L44: accept quantity "enough" and prep "cold" or null.
5. L37: accept quantity "1 heaped". L26: accept ingredient "coriander leaves" with prep
   "picked".
6. Keep L07 and L23 as they are, since L07 is the README's own example. Handle them
   outside Jev instead: a deterministic rule for tap water and ice, and context from the
   neighbouring lines for bare-word headers.

**Revised stage verdicts.**

| Stage | Phase 1 | Phase 2 verdict |
|---|---|---|
| Segment: header / ingredient / note | Fits well | Fits. Bare-word headers escalate, so pass the next line as context |
| Segment: compound lines | Fits with reframing | Fits as a 3-way Choice. The split itself stays in code |
| Classify line kind | Fits well | Fits. The tap-water policy should be a rule, since Jev reads it as quantified |
| Extract qty / unit / ingredient / prep / notes | Fits with reframing | Fits with reframing (confirmed). Use v2: the token marked in the line, fillers merged in code, numbers parsed in code. The span pick is a cross-check |
| Resolve ingredient to KB | Fits well, given candidates | Fits, given candidates. Include generic parents ("butter") |
| Resolve unit / locale | Fits with reframing | Fits, but on this set a source-domain rule scores the same 7/7. Use Jev only for unknown sites |
| Tags, single-label | Fits well | Fits |
| Tags, multi-label | Fits with reframing | Fits with reframing. Needs non-overlapping label definitions and per-label thresholds (Nouls sat at 0.6-0.8 on edge cases) |
| Messy leftovers | Does not fit | Not tested. Still needs an LLM |

No tested stage needs an LLM. The main caveat is sample size. The v2 criteria were
written after I had seen the v1 misses, so the 0.92 extraction figure needs a held-out
set of fresh lines before anyone relies on it.

**Spend.** 276k input tokens across the three runs, about $0.012 in total.

## Summary

Jev is a "System One" model from TypeSafe AI, launched 2026-09-15. It never generates
text. You send a `state` (a string or JSON) plus a map of typed questions, and it returns
one typed answer per question. There are three question types: **Choice** (pick one of up
to 255 options you supply at request time), **Score** (an ordered rubric of 2-10 levels)
and **Noul** (a yes/no probability). Choice and Score answers come with a full
probability distribution and a `confidence`. Label sets are always zero-shot and supplied
per request, and there is no fine-tuning, so every account uses the same weights.

This shape suits most of our pipeline, because each stage can be phrased as "pick one
from a closed set". Extraction is the exception. Jev cannot label spans or emit strings,
so extraction has to be reframed: either as one Choice per token, or as a Choice over
candidate spans that code enumerates first. TypeSafe documents the second pattern
itself. The docs are also explicit that arithmetic, counting and comparing numbers are
weak points, which means quantity parsing and unit conversion stay deterministic.

The per-stage fit table, with the phase 1 and phase 2 verdicts side by side, is under
"Revised stage verdicts" above.

## Details

**API.** `POST https://api.typesafe.ai/v1/systemone` with `Authorization: Bearer <key>`.
The body is `{state, model, questions}`, where `questions` maps ids you choose to
`{type, instructions, criteria}`. `instructions` and `criteria` can be strings or JSON, and
instructions can point at parts of the state by name in backticks (for example
`` `tokens[3]` ``). `GET /v1/models` lists aliases. Errors are 401, 422, 429 and 529;
the docs ask for exponential backoff on 429/529 and say the SDKs honour `retry-after`.
Keys are issued at console.typesafe.ai/keys, and there is a browser Playground.

**Task types.**
- Single-label: Choice, with at most 255 options. Options can be supplied dynamically per
  request, so a top-k candidate list works directly. The docs recommend adding a
  "none" option.
- Multi-label: no native type. The documented approach is one Noul per label. The docs
  also warn that a Choice and a set of Nouls answer different questions, since a Choice
  is relative and each Noul is absolute.
- Ordinal: Score, 2-10 levels. It returns a probability-weighted value, which the docs
  say must not be used to interpolate exact numbers.
- Span or token labelling: not supported natively. The docs recommend that code
  (regex or an LLM) finds candidate spans and Jev picks one, so the output is always a
  verbatim copy of real text. Their "line-by-line search" cookbook scores 218 line ids
  with one Choice.
- Structured output: every answer is typed by construction, so it cannot return an
  off-list label.

**Batching.** Many questions against one state go in one request. They are evaluated in
parallel, and the docs claim extra questions barely move latency (one cookbook measures
13 questions in one call as 12.2x cheaper and 10.0x faster than 13 calls). I found no
endpoint that batches several *states* in one call, so 40 lines means 40 requests.

**Limits.** Context is 64k tokens per request, of which 32k covers the state plus the
longest single question. Input is text only (string, JSON object or array). English is the
primary language. Rate limits are 250,000 tokens/s and 1,200 requests/min, and the docs
say these are "adjusting dynamically" and can change without notice.

**Latency and price.** The launch post claims 70-500 ms end to end and "40x-200x faster"
than frontier LLMs. Price is $0.042 per million input tokens, and output is free. Some
third-party articles quote $0.42/M, which is ten times the primary figure, so they should
be ignored. I found no pricing page, free tier or credit information. Phase 2 measured
actual cost.

**Confidence.** Choice and Score answers carry `confidence` in 0-1, derived from how
concentrated the distribution is. Noul answers carry only the probability. TypeSafe claims
calibration ("higher confidence means higher accuracy") and suggests three bands: act,
confirm, route to a human. That maps directly onto our strict, then Jev, then LLM, then
human escalation.

**Customisation.** No fine-tuning or LoRA. Domain knowledge goes into `state`,
`instructions` and `criteria`. One cookbook trains CatBoost on Jev's probabilities.

**Known weaknesses (jev-1.13 "jaggedness" page).** It reads literally. It is unreliable at
maths, counting, numeric representations and date comparison. Accuracy drops with a large
state full of irrelevant detail, and with indirection. Adversarial text can steer it. It
cannot generate. Structural invariants do not hold between questions (for example, a
Noul and its negation need not sum to 1). For us, this means fractions, ranges and
conversions belong in code, and the state should be one line, not the whole recipe.

**SDKs.** Python `typesafe-sdk` (0.7.1 on PyPI, Python 3.10+, sync and async clients) and
JavaScript/TypeScript `@typesafe-ai/sdk` (Node 20+). Both read `TYPESAFE_API_KEY` and
retry by default. A JS SDK fits our React/PWA stack, but calls should go server side so
the key is never shipped to the browser. The GitHub org's `system-one-adapter-python`
("drop-in TypeSafeClient replacement backed by LLM APIs") could give the LLM tier the same
interface.

**Data handling.** The docs say Jev is not trained on customer requests or responses, and
the privacy policy says "We will not train or fine tune any artificial intelligence or
machine learning models on your prompts or other Input". Retention is only "as long as
reasonably necessary". Zero data retention is offered to enterprise customers only.
Recipe lines are low sensitivity, so I think this is acceptable.

**Versioning.** Aliases move when releases ship. The docs advise pinning a versioned id
once confidence thresholds are tuned, so the spike pins `jev-1.13.0`.

## Sources (primary, fetched 2026-09-25)

- Launch post: https://typesafe.ai/blog/introducing-system-one-models-and-jev
- Site: https://typesafe.ai
- Docs index: https://docs.typesafe.ai/llms.txt
- API reference: https://docs.typesafe.ai/api.md
- Models, limits, pricing, customisation: https://docs.typesafe.ai/models.md
- Quick start: https://docs.typesafe.ai/introduction/quickstart.md
- Primitives: https://docs.typesafe.ai/primitives.md, https://docs.typesafe.ai/primitives/choice.md
- Confidence: https://docs.typesafe.ai/confidence.md
- Jaggedness: https://docs.typesafe.ai/model-jaggedness/jev-1.13.md
- Speculative fan-out: https://docs.typesafe.ai/patterns/fan-out.md
- Pre-parsed value extraction: https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md
- Line-by-line search: https://docs.typesafe.ai/cookbooks/semantic_find.md
- Hierarchical classification: https://docs.typesafe.ai/cookbooks/hierarchical_classification.md
- SDKs: https://docs.typesafe.ai/sdk.md, https://docs.typesafe.ai/sdk/python/api/constants.md, https://docs.typesafe.ai/sdk/javascript.md
- PyPI: https://pypi.org/project/typesafe-sdk/
- GitHub org: https://github.com/typesafe-ai
- Legal: https://docs.typesafe.ai/legal.md, https://typesafe.ai/legal/privacy-policy, https://typesafe.ai/legal/data-processing
