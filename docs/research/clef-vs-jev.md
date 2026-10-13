# Clef as an alternative to Jev

Date: 2026-10-13. Ticket: [Spike: Clef as an alternative to Jev](https://github.com/Ed-Barnes937/FindersEaters/issues/65). It questions a choice made in [Design the engine pipeline](https://github.com/Ed-Barnes937/FindersEaters/issues/10). Background: `docs/ideation/research/jev-capabilities.md`, `docs/spec/engine-pipeline.md` section 4.

## What Clef is

"Clef" here is **Cloudflare's Clef**: a pair of open-weight decision models released on 2026-10-01 ([Cloudflare blog](https://blog.cloudflare.com/clef-decision-models/)).
- **Clef** has 27B parameters ([model card](https://huggingface.co/Cloudflare/clef)).
- **Clef-flash** has 9B parameters and is post-trained from Qwen3.5-9B ([model card](https://huggingface.co/Cloudflare/clef-flash)).
- **Clef-omni** (30B mixture of experts, 2026-10-09) also exists but adds nothing for text-only lines.

Clef is the only candidate that fits. It is a direct Jev competitor and takes the same `POST /v1/systemone` request and response body. Cloudflare says it is "fully API-compatible" with Jev. Other uses of the name, such as a music-notation clef or old login products, have nothing to do with recipe parsing or decision models.

## Summary

**Stay with Jev for the V0.1 build. Whether to switch is undecided until a hosted, held-out comparison has run.**

- **Accuracy (better).** On the dev golden lines, run locally, Clef (27B) matched or beat Jev v2 on every line-level stage except KB resolution. It was much better on extraction: 0.97 vs 0.92 all-fields, and 89% vs 76% auto-accepted at a 0.6 gate, with no wrong answer at 0.6 or above.
- **Clef-flash (worse).** Clef-flash was clearly worse on extraction (0.71). Its misses repeat the size and conversion problems that v2 fixed for Jev.
- **Why dev cannot decide it.** The dev set is small: 35 extraction lines and 3 recipes. The v2 template was tuned on Jev's own dev misses. The runs used community 4-bit and 8-bit quantisations on a laptop, not Cloudflare's hosted weights.
- **Pinning (blocker).** Hosted model ids are unversioned. Within 8 days of launch Clef-flash changed price and context length under the same id. That breaks the engine's exact-model-pin rule.
- **Cost (higher).** Hosted Clef costs about 5.7x Jev per input token. That is still about 1p per recipe, but higher.

## Hands-on comparison (dev set only)

**Method.**
- `run_spike.py --framing v2 --taxonomy phase2 --set dev` was run unchanged except for two new flags: `--api-url`, which points it at a local SystemOne-compatible server and sends no key, and `--timeout`.
- The script refuses `--api-url` unless `--set dev` is given, and asserts that every loaded item is dev. **No held-out line or recipe was sent to any model.**
- The models ran on an M3 Pro (36 GB) through each MLX build's bundled `clef_mlx.py serve`, which runs the backbone and the joint schema head:
  - Clef-flash: [`mlx-community/clef-flash-8bit`](https://huggingface.co/mlx-community/clef-flash-8bit)
  - Clef: [`mlx-community/clef-4bit`](https://huggingface.co/mlx-community/clef-4bit)
- Both quantisations were made by the community, not Cloudflare.
- Code, raw JSONL and summaries are on the throwaway branch [`spike/clef`](https://github.com/Ed-Barnes937/FindersEaters/tree/spike/clef/docs/ideation/research/jev-spike).
- The Jev column is the phase 2 v2 run from 2026-10-04 (`jev-capabilities.md`). Its raw results are gitignored and not on this machine, so it could not be rescored. Extraction n is 37 there and 35 here, because the scorer and labels have changed since. Read small differences as noise.

| Stage (probe) | n | Jev v2 acc | Clef acc | Clef-flash acc | Jev v2 auto@0.8 | Clef auto@0.8 | Clef-flash auto@0.8 |
|---|---|---|---|---|---|---|---|
| Segment: role | 44 | 1.00 | 1.00 | 1.00 | 0.98 | 0.89 | 0.84 |
| Segment: compound | 39 | 1.00 | 1.00 | 1.00 | 0.97 | 0.77 | 0.90 |
| Classify kind | 39 | 0.95 | **1.00** | 0.95 | 0.92 | 0.90 | 0.95 |
| Extract, all six fields | 35-37 | 0.92 | **0.97** | 0.71 | 0.59 | 0.40 | 0.23 |
| Extract, auto-accepted at a 0.6 gate | 35-37 | 0.76 (0 wrong) | **0.89 (0 wrong)** | 0.51 (0 wrong) | | | |
| Extract: ingredient span pick | 35-37 | 0.95 | 0.97 | 0.97 | 0.78 | 0.60 | 0.49 |
| Resolve ingredient (4 candidates + none) | 18 | **1.00** | 0.94 | 0.94 | 0.78 | 0.89 | 0.78 |
| Resolve unit system | 7 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.86 |
| Tags: cuisine / meal / effort (Choice) | 3 each | 0.67 / 1.00 / 1.00 | 1.00 / 1.00 / 0.67 | 1.00 / 1.00 / 1.00 | | | |
| Tags: protein / carb / method (Noul at 0.5) | 3 each | 1.00 / 1.00 / 0.67 | 1.00 / 1.00 / 0.33 | 1.00 / 0.67 / 1.00 | | | |

**Calibration.** Neither Clef model gave a wrong answer at 0.8 or above. At 0.6 or above, the only wrong answers were one resolution each: L32 crisps, at 0.72 (Clef) and 0.62 (Clef-flash). Jev v2 also had no wrong answer at 0.8 or above.

Clef's confidence runs lower than Jev's. Its auto-accept share at 0.8 is lower even where its accuracy is higher. So a Clef deployment would need its own gates, and 0.6 looks right for extraction. The current pass rule (a 0.6 extraction gate only if held-out accuracy at 0.6 is at least 0.95) already handles this.

**Misses.**
- **Clef (27B)** had six:
  - L32 "ready salted crisps" resolved to `crisps_ready_salted` instead of none. This is arguably a candidate-list question, not a model error.
  - L36: span pick at 0.47.
  - L40: "1 stock cube into 500ml boiling water" read 500ml as the amount, at 0.40. Jev made the same miss.
  - R02 effort at 0.51.
  - Method Nouls on R02 and R03. The 0.5 Noul threshold is not calibrated for Clef.
- **Clef-flash** missed 9 of 35 extraction lines, all below 0.6. Five of them, L02, L04, L13, L27 and L29, are the size, conversion and parenthetical cases ("400g tin", "250g/9oz", "(about 200g)") that broke Jev v1 and that v2's wording fixed. The template does not transfer to the smaller model.
- **Both** flipped L07 or L44 ("a splash of water", "enough cold water to cover") between kinds, as Jev did. Those were already listed as judgement calls.

**Tokens and latency.** Clef's tokenizer gives about 3.4k input tokens per line request, close to Jev's 3.2k. Laptop latency (Clef-flash p50 9 s, Clef p50 31 s) says nothing about hosted latency. Cloudflare reports a median of 39 ms for Clef-flash, 209 ms for Clef and 524 ms for Jev ([model card](https://huggingface.co/Cloudflare/clef)). Those are its own measurements, not checked here.

## Desk findings

| Question | Jev (`jev-1.13.0`) | Clef / Clef-flash | Source |
|---|---|---|---|
| Question types | Choice, Noul, Score; we build token labelling and span pick from Choice | The same three types; Choice 2-255 options, Score 2-10 levels, 1-64 questions per request. Choice and Score return the full probability map, so top-3 alternatives come free. Noul returns P(yes) only, as Jev's does. | [Workers AI schema](https://developers.cloudflare.com/workers-ai/models/clef/) |
| Benchmarks | n/a | Cloudflare's internal 41-benchmark "Decision Index" run: mixed. Clef wins on intent classification (BANKING77, CLINC150) and loses on reasoning (GPQA, MMLU-Pro, BBH). The Jev version tested is not stated, and there is no recipe or extraction benchmark. | [model card](https://huggingface.co/Cloudflare/clef) |
| Price (input; output free) | $0.042/M | Clef $0.240/M; Clef-flash $0.038/M; a free tier of 10,000 neurons a day (about 140 Clef or 900 Clef-flash line requests) | [typesafe models](https://docs.typesafe.ai/models.md), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Per recipe (15 lines, about 50k tokens) | about 0.2p | Clef about 1p, Clef-flash about 0.2p. The 2,000-request daily cap would cost at most about $1.60 a day on Clef. | arithmetic |
| Context | 64k per request | Hosted Clef 64k; hosted Clef-flash 24k (cut from 64k on 2026-10-09); self-hosted defaults to 16k. Our largest request is 7.4k. | [changelog](https://developers.cloudflare.com/changelog/post/2026-10-09-clef-omni-workers-ai/) |
| Model pinning | Exact versioned id | Unversioned `@cf/cloudflare/clef` and `@cf/cloudflare/clef-flash`. Price and context changed under the same id in week one. Deprecated Workers AI models have been auto-aliased to successors. Open weights can be pinned by Hugging Face commit only if self-hosted. | [changelog](https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/) |
| Determinism | Choices identical across repeats in our spike | Not stated | n/a |
| UK English, metric | Nothing published | Nothing published. In the local run both Clef models got all 7 unit-system lines (UK/US/AU) right, as Jev did. | hands-on |
| Licence and hosting | Closed SaaS | Apache-2.0 weights. Self-hosting needs a GPU: Cloudflare tested on an H200; Clef-flash in BF16 fits a 48 GB L40S. That is far beyond the £2 a month hosting budget, so in practice it means Workers AI. | [model card](https://huggingface.co/Cloudflare/clef) |
| Data location | US (TypeSafe) | Workers AI does not support Regional Services, so there is no UK or EU-only processing | [data localisation](https://developers.cloudflare.com/data-localization/compatibility/) |
| Lock-in | One vendor, closed weights | Same request schema on Jev, Workers AI and self-hosted SGLang. Open weights are a real exit. | blog, model card |
| Fine-tuning | none | "RL for Calibrated Decisions" exists, but only as hands-on work with Cloudflare engineers; 37 golden lines is far too small to use it | [blog](https://blog.cloudflare.com/clef-decision-models/) |

Not verified: a Clef-specific rate limit (the "Text Generation" default of 300 requests a minute is a guess); whether hosted Workers AI wraps the SystemOne body in Cloudflare's `{result, success}` envelope; hosted determinism; and UK or EU latency.

## Fit with the pipeline

- **Stage modes and gates** carry over unchanged, because they are model-agnostic configuration. Clef's lower confidences mean every gate would be re-tuned on held-out, and the spec already requires that for any model change.
- **Stored answers and review alternatives** work as they are, because Choice returns the full probability map.
- **Cassettes** are keyed by framing version, model pin and request hash. That works, but with an unversioned hosted id a recorded cassette can silently stop matching live behaviour. Running hosted Clef would need a scheduled live dev-set canary, or self-hosting.
- **Partial runs and the spend guard** are unchanged in shape. The cap's money basis would change, because Clef costs about 5.7x more per request.
- **Using both by stage** is technically easy, since it is one request format. It is not worth it on this evidence. The one stage where Clef clearly helped, extraction, is the per-line request that carries most of the tokens, so splitting stages would add a second vendor without saving anything.

## Recommendation

**Stay with Jev for the V0.1 build as specified. Whether to switch is undecided, pending three things:**

1. The owner's blind check of the held-out labels, already tracked in [Rerun Jev v2 on the held-out golden lines](https://github.com/Ed-Barnes937/FindersEaters/issues/19).
2. A three-way held-out run of Jev v2, hosted Clef and hosted Clef-flash with the same template. This needs a **Cloudflare account ID and an API token with Workers AI Read and Edit** (the 167 held-out requests per model fit the free tier for Clef-flash in one day, and for Clef across about two days or on the Workers Paid plan). Switch only if Clef beats Jev on held-out extraction at a 0.6 gate and is no worse on every other stage under the pass rule in `docs/research/golden-set.md`.
3. A way to meet the exact-pin rule: Cloudflare publishes versioned Clef ids, or the owner accepts a scheduled live canary in place of a pin.

If Clef wins all three, the switch is cheap because the request format is identical. The cost rises from about 0.2p to about 1p per recipe, and the gates are re-tuned.

## What a switch would change (not applied)

- **[Jev client with recorded cassettes and stage modes](https://github.com/Ed-Barnes937/FindersEaters/issues/41)**: endpoint, auth header and model id come from configuration. The response envelope may need unwrapping, Cloudflare's error and retry codes replace 429 and 529, and the cassette key uses the Workers AI id plus a canary date. It is a good idea to make the base URL and model id configuration now, whichever model ships.
- **[Engine skeleton: pipeline, output type, versioning and the golden-set harness](https://github.com/Ed-Barnes937/FindersEaters/issues/40)**: the harness records the model id, and the engine version covers a model swap.
- **[Engine recipe level: tags, derived diet, yield and time; golden pass rule in CI](https://github.com/Ed-Barnes937/FindersEaters/issues/44)**: Noul thresholds for the multi-valued tags are re-tuned per value, because Clef's method Nouls failed at 0.5.
- **[Lazy completion, batch re-parse, projection rebuild and Jev spend guard](https://github.com/Ed-Barnes937/FindersEaters/issues/47)**: the daily cap is re-based on Clef's price and the free-tier neuron count.
- **[Provisioning wizard for staging and production (owner runs it)](https://github.com/Ed-Barnes937/FindersEaters/issues/35)** and **[Docker image, Fly config, release step and /health](https://github.com/Ed-Barnes937/FindersEaters/issues/34)**: the secret `TYPESAFE_API_KEY` becomes a Cloudflare account ID and token.
- **[Go-live: production release, library import and owner reviews](https://github.com/Ed-Barnes937/FindersEaters/issues/64)**: the stage-mode flips come from the Clef held-out result.
- **Specs**: `engine-pipeline.md` section 4 (model pin), `operations.md` (secrets), and `v0.1.md` 17.6 (spend cap).
