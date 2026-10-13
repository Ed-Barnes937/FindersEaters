# Clef as an alternative to Jev

Date: 2026-10-13. Ticket: [Spike: Clef as an alternative to Jev](https://github.com/Ed-Barnes937/FindersEaters/issues/65). It questions a choice made in [Design the engine pipeline](https://github.com/Ed-Barnes937/FindersEaters/issues/10). Background: `docs/ideation/research/jev-capabilities.md`, `docs/spec/engine-pipeline.md` section 4.

## What Clef is

"Clef" here is **Cloudflare's Clef**: a pair of open-weight decision models released on 2026-10-01 ([Cloudflare blog](https://blog.cloudflare.com/clef-decision-models/)).
- **Clef** has 27B parameters ([model card](https://huggingface.co/Cloudflare/clef)).
- **Clef-flash** has 9B parameters and is post-trained from Qwen3.5-9B ([model card](https://huggingface.co/Cloudflare/clef-flash)).
- **Clef-omni** (`@cf/cloudflare/clef-omni`, 30B mixture of experts built on Qwen3-Omni-30B-A3B, 2026-10-09) adds image, audio and video input. On our text-only dev lines it is fast but weak at extraction; see "Reconciling with Cloudflare's benchmarks".

Clef is the only candidate that fits. It is a direct Jev competitor and takes the same `POST /v1/systemone` request and response body. Cloudflare says it is "fully API-compatible" with Jev. Other uses of the name, such as a music-notation clef or old login products, have nothing to do with recipe parsing or decision models.

## Summary

**Revised again 2026-10-13 after reconciling with Cloudflare's 2026-10-09 post, given the owner's preference for Cloudflare as a company and acceptance of the higher cost: switch the V0.1 build to hosted Clef (27B, `@cf/cloudflare/clef`), provided the owner accepts a daily live dev-set canary in place of the exact-model pin.** Not Clef-flash, not Clef-omni. The first pass, on laptop weights only, said stay with Jev; see "Hosted run" and "Reconciling with Cloudflare's benchmarks" for what changed.

- **Accuracy (as good or better where it counts).** On the dev golden lines, hosted Clef scored 0.97 on extraction all-fields (Jev v2 0.92) and 1.00 on kind (0.95). It was slightly worse on segment role (0.93 vs 1.00), compound (0.97 vs 1.00) and resolution (0.94 vs 1.00), and all but one of those misses had a confidence below 0.6.
- **Calibration (close to Jev once measured the same way).** The low hosted confidences in the first hosted write-up were our bug: Workers AI fills `confidence` with a different formula from Jev and the laptop server. Computing Jev's formula from the returned probabilities, hosted Clef auto-accepts 71% of extraction lines at 0.6 with none wrong, against 76% for Jev and 80% for the laptop build. Its one wrong answer at 0.6 or above is the L32 crisps resolution (0.70), a candidate-list question; none at 0.8.
- **The pipeline computes confidence itself.** Gates must read one formula computed from `probabilities`, never the provider's `confidence` field.
- **Clef-flash and Clef-omni (no).** Clef-flash scored 0.66 on extraction and Clef-omni 0.57. Clef-omni also auto-accepted five wrong extraction lines at 0.6.
- **Deterministic, enveloped, slower than Jev.** Repeats were byte-identical. Responses come wrapped in `{result, success, errors, messages}`. From the UK, Clef took p50 515 ms and p95 1.4 s, against Jev's p50 278 ms and p95 331 ms. Most of the gap to Cloudflare's published 305 ms is time spent inside Cloudflare before the model runs, not the network. The spec's 2 s request timeout needs raising.
- **Pinning (owner decision).** Cloudflare offers no versioned or pinnable Clef ids, and its serving has already changed under the same id. A daily dev-set canary that fingerprints the answers would replace the pin. Relaxing the exact-pin rule is the one hard-to-reverse part, so it goes to the owner.
- **Cost (accepted).** About 5.7x Jev per input token, about 1p per recipe.

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

## Hosted run (dev set only, 2026-10-13)

**Method.**
- The same `run_spike.py --framing v2 --taxonomy phase2 --set dev` with a new `--workers-ai` flag. It posts to the Workers AI `/ai/run/@cf/cloudflare/<model>` endpoint, sends `"model": "clef"` or `"clef-flash"` in the body, and unwraps Cloudflare's envelope. The account ID and token come from the environment and are never printed or stored.
- `--workers-ai` refuses anything but `--set dev`, as `--api-url` does. **No held-out line or recipe was sent to any model.**
- 47 requests per model (44 lines, 3 recipes), sent one at a time from the UK, plus 6 repeated requests per model for determinism.
- No Jev key was available, so the Jev column is still the 2026-10-04 v2 run.
- Code, raw JSONL and summaries are on [`spike/clef`](https://github.com/Ed-Barnes937/FindersEaters/tree/spike/clef/docs/ideation/research/jev-spike/results) (`*_cf_cloudflare_*` and `summary-*-hosted-workers-ai-dev.txt`).

Confidence columns below use Jev's formula, computed from the returned probabilities for every model (corrected 2026-10-13; see "Reconciling with Cloudflare's benchmarks").

| Stage (probe) | n | Jev v2 | Clef hosted | Clef laptop (4-bit) | Clef-flash hosted | Clef-flash laptop (8-bit) |
|---|---|---|---|---|---|---|
| Segment: role | 44 | 1.00 | 0.93 | 1.00 | 1.00 | 1.00 |
| Segment: compound | 39 | 1.00 | 0.97 | 1.00 | 1.00 | 1.00 |
| Classify kind | 39 | 0.95 | **1.00** | 1.00 | 0.95 | 0.95 |
| Extract, all six fields | 35-37 | 0.92 | **0.97** | 0.97 | 0.66 | 0.71 |
| Extract, auto-accepted at a 0.6 gate (wrong) | 35-37 | **0.76 (0)** | 0.71 (0) | 0.80 (0) | 0.49 (0) | 0.46 (0) |
| Extract: ingredient span pick | 35-37 | 0.95 | 0.97 | 0.97 | 1.00 | 0.97 |
| Resolve ingredient | 18 | **1.00** | 0.94 | 0.94 | 0.94 | 0.94 |
| Resolve unit system | 7 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Wrong answers at 0.6 or above, all stages | | 0 at 0.8 | 1 | 1 | 2 | **0** |
| Wrong answers at 0.8 or above, all stages | | 0 | 0 | 0 | 0 | 0 |
| Median extraction confidence | | | 0.74 | 0.72 | 0.51 | 0.56 |
| Latency p50 / p95 | | 278 / 331 ms | 515 / 1,401 ms | 31 s (laptop) | 875 / 1,695 ms | 9 s (laptop) |

**Accuracy.** Hosted Clef gave the same top answers as the laptop build on extraction, kind, span pick and resolution, with the same misses (L32 crisps, L35 "a handful", L36 span). It lost three segment answers that the laptop got right: L07 and L44, the known judgement calls, and L23, a header read as an ingredient (confidence 0.08). It also called L31 compound at 0.17. All four were far below any gate. Recipe tags matched or beat the laptop run; method Nouls still fail at 0.5 (R02, R03).

**Calibration.** Corrected: the first version of this section said hosted Clef was much less confident than the laptop build (median 0.56 vs 0.76, 40% vs 89% auto-accepted). That compared two different formulas, not two confidences; see "Reconciling with Cloudflare's benchmarks". Measured the same way, hosted Clef auto-accepts 71% of extraction lines at 0.6 with none wrong, and its top probabilities differ from the laptop build's by a median of 0.001. Five extraction lines cross the 0.6 gate in one direction or the other (L09, L29, L34 and L37 down; L30 up), which fits 4-bit quantisation noise. The one wrong answer at 0.6 or above is the L32 crisps resolution (0.70 hosted, 0.65 laptop).

A serving change can still move confidences without moving answers, so gates depend on the canary below.

**Envelope.** Every response was `{"errors", "messages", "result", "success"}`, with the SystemOne body (`model`, `answers`, `usage`) inside `result`. The inner `model` is just `"clef"` or `"clef-flash"`, with no version. Input was 3.36k tokens per request, close to Jev's 3.2k.

**Determinism.** The first six line requests were re-sent to each model. All 59 answers per model were byte-identical, probabilities included.

**Latency.** These are wall-clock times from the UK, sequential, including TLS and Cloudflare's routing, not the 39 ms and 209 ms server medians Cloudflare publishes. Clef-flash was slower than Clef here, which suggests load or placement matters more than model size. Clef's maximum was 2.4 s, so the spec's 2 s timeout would have failed a request. Something nearer 5 s fits inside the 8 s import budget with 8 requests in parallel.

**Pinning.** There are no versioned ids.
- The Workers AI model search API lists exactly one entry each for `@cf/cloudflare/clef`, `clef-flash` and `clef-omni`. Each has a UUID, a created date, a context window and a price, and no version field.
- The [model page](https://developers.cloudflare.com/workers-ai/models/clef/) and [changelog](https://developers.cloudflare.com/changelog/product/workers-ai/) document none either.
- In two weeks the same ids have had a price cut, a context cut and a serving speed-up.
- Exact pinning is possible only by self-hosting the Hugging Face weights, which is out of budget.

**Minimal canary to replace the pin.**
- **What.** A scheduled CI job, once a day and before every release, runs the golden harness on the dev set against hosted Clef: 47 requests, about 158k input tokens, about $0.04 a run.
- **Fingerprint.** Hosted answers are deterministic, so a SHA-256 of the canonical answers (choice and probabilities as returned) works as a version id. The engine configuration stores `model: @cf/cloudflare/clef` plus that fingerprint. Both go into the engine version and the cassette key, in place of an exact model id.
- **On a mismatch.** The job fails and opens an issue with the per-stage scores and the changed answers. Production keeps running. Before the fingerprint is re-baselined, which makes a new engine version, the golden set is rerun under the pass rule, including held-out once it is cleared. If a stage no longer passes, it goes back to `review-first`.
- **Gap.** A change can go unnoticed for up to a day. For a household recipe app with review on every flagged decision, that is acceptable.
- **Secrets.** CI needs the Cloudflare account ID and token as repository secrets.

## Reconciling with Cloudflare's benchmarks (dev set only, 2026-10-13)

Cloudflare's 2026-10-09 post ([Clef: faster, cheaper, multimodal](https://blog.cloudflare.com/clef-faster-cheaper-multimodal/)) claims 305 ms median and 531 ms p95 for about 3,400-token Clef requests after SGLang serving changes, Brier-score calibration in training, a $0.038/M Clef-flash price and a new Clef-omni at about 130 ms. The owner asked why our hosted run did not match. Code and raw output are on [`spike/clef`](https://github.com/Ed-Barnes937/FindersEaters/tree/spike/clef/docs/ideation/research/jev-spike/results) (`rescore-jevconf-*`, `latency-probe-*`, `models-workers-ai-clef.txt`, `*clef-omni*`). Held-out was not touched; both scripts still refuse anything but `--set dev`.

**1. The confidence gap was our bug.** Every Choice answer carries `probabilities` and a `confidence` that the docs only describe as "derived from the probabilities". The three servers derive it differently, and we compared the field as returned. Checked against all 446 Choice answers per run:

| Server | `confidence` is | Fits within |
|---|---|---|
| Jev ([docs](https://docs.typesafe.ai/confidence.md)) | (p_max - 1/n) / (1 - 1/n) | documented |
| Laptop `clef_mlx.py serve` | p_max | 0.0000 |
| Workers AI (all three Clef models) | (n·Σp² - 1) / (n - 1), a normalised Gini concentration | 0.0002 |

The Workers AI version is much harsher on spread-out distributions: L02's first token has p_max 0.61, laptop confidence 0.55, Workers AI confidence 0.32. The model's probabilities are not the cause. Hosted and laptop top probabilities differ by a median of 0.001 and the top answer is the same in 432 of 446 questions. Nothing else was at fault: the envelope is unwrapped correctly, no temperature or sampling parameter is sent or accepted, the request bodies are byte-identical apart from the `model` string, and input token counts match (4,918 on L02 in both).

**Fix.** `run_spike.py` now computes confidence from `probabilities` with one formula (`--confidence jev` by default, which keeps the Jev v2 numbers comparable). Rescored, hosted Clef auto-accepts 71% of extraction lines at 0.6 with none wrong (Jev 76%, laptop 80%). The rescore needed no new requests. The lesson for the build is that the engine must compute confidence itself, because a provider can define or redefine the field without notice.

**Calibration claims.** Brier-score training calibrates the probabilities, which is what we now gate on. On dev, hosted Clef extraction answers between 0.6 and 0.8 were 112 of 112 right and those between 0.5 and 0.6 were 41 of 42 right, so it is, if anything, still underconfident. Thirty-five lines cannot confirm a calibration claim; held-out has to.

**2. Latency: mostly time inside Cloudflare, little of it network.** `probe_hosted.py` timed 20 requests per case on 2026-10-13 (evening, UK):

| Clef (27B), from the UK | p50 | p95 |
|---|---|---|
| TCP connect / TLS handshake | 18 / 38 ms | 21 / 45 ms |
| 120-token request, kept-alive connection | 419 ms | 1,147 ms |
| 4,900-token dev line (L02), kept-alive | 551 ms | 731 ms |
| Same, fresh connection each time (as `run_spike.py` does) | 667 ms | 736 ms |
| Same, 8 concurrent | 593 ms | 801 ms |

- Every response came through Cloudflare's London edge (`cf-ray` ends `-LHR`). No `server-timing` or other header says where the GPU ran or how long the model took.
- Network and TLS cost about 60 ms per fresh connection, and `run_spike.py` paid that on every request. A kept-alive client removes it.
- A 120-token request takes about 420 ms, nearly as long as a 4,900-token one. So most of the time is a fixed cost before the model runs: queueing, routing to a GPU location, or load. It is not prompt length. The same trivial request on Clef-omni took 135 ms.
- Cloudflare's 305 ms appears to be time on its serving layer; the post does not say where the timer sits or from which location. Our first run's 515 ms median for 3,360-token requests is about 450 ms after the handshake. The remaining gap of about 150 ms is the fixed overhead above, and it varied by hour: p95 was 1.4 s in the afternoon and 0.74 s in the evening.
- Concurrency of 8 added about 40 ms at the median. An import of 15 lines at 8 at a time would take about 1.2 s of model time.

**3. Clef-omni (`@cf/cloudflare/clef-omni`).** Same dev run as the others, Jev's confidence formula:

| Dev set | Jev v2 | Clef hosted | Clef-omni hosted |
|---|---|---|---|
| Extraction, all six fields | 0.92 | **0.97** | 0.57 |
| Extraction auto-accepted at 0.6 (wrong lines) | 0.76 (0) | 0.71 (0) | 0.63 (5) |
| Extraction auto-accepted at 0.8 (wrong lines) | 0.59 (0) | 0.34 (0) | 0.26 (0) |
| Kind / role / compound | 0.95 / 1.00 / 1.00 | 1.00 / 0.93 / 0.97 | 0.97 / 0.95 / 0.90 |
| Resolution / unit system | 1.00 / 1.00 | 0.94 / 1.00 | **1.00** / 1.00 |
| Median extraction confidence | | 0.74 | 0.69 |
| Latency p50 / p95, sequential, fresh connections | 278 / 331 ms | 515 / 1,401 ms | **256 / 749 ms** |
| Price per M input tokens | $0.042 | $0.24 | $0.15 |

Clef-omni is twice as fast as Clef and resolves well, but it has Clef-flash's extraction failures: pack sizes split across fields ("400g tin", "25g pack"), conversions and parentheticals folded into the amount ("250g/9oz", "(2 sticks)") and notes read as names ("such as Maris Piper"). Five of those wrong lines scored 0.61 to 0.74, so it is overconfident where it matters. It was deterministic across six repeats. It is not a candidate for V0.1.

**Current prices** (Workers AI model listing and TypeSafe models page, 2026-10-13; input only, output free):

| Model | $ per M input | Per recipe (15 lines, about 50k tokens) | Daily dev canary (158k tokens) | 2,000-request daily cap |
|---|---|---|---|---|
| Jev 1.13 | 0.042 | $0.002 (0.2p) | $0.007 | $0.28 |
| Clef-flash | 0.038 | $0.002 (0.2p) | $0.006 | $0.26 |
| Clef-omni | 0.15 | $0.0075 (0.6p) | $0.024 | $1.01 |
| Clef | 0.24 | $0.012 (about 1p) | $0.038 | $1.61 |

The earlier figures were right; Clef-omni's price is new. Clef costs 5.7x Jev per token.

**4. How far the post's benchmarks transfer.** The post's benchmarks are tool and function selection (BFCL, ToolRet, API-Bank, When2Call, a home-appliance set), intent classification (BANKING77, CLINC150 with out-of-scope), retrieval and product matching (BRIGHT, Amazon ESCI) and phishing (PhishNChips). All of them pick one label or item for a whole input, which is close to our role, kind and resolution stages, and those are where the Clef models matched Jev on dev. None of them labels individual words in a sentence, follows a tight per-option definition such as "the 8 and oz in 225g/8oz are a note", or covers UK recipe wording. That kind of extraction carries most of our decisions, and it is where the models split: Clef 0.97, Clef-flash 0.66, Clef-omni 0.57, Jev 0.92. So the benchmarks are fair evidence for our classification stages and no evidence for extraction. Our golden set has to decide, and it did.

## Desk findings

| Question | Jev (`jev-1.13.0`) | Clef / Clef-flash | Source |
|---|---|---|---|
| Question types | Choice, Noul, Score; we build token labelling and span pick from Choice | The same three types; Choice 2-255 options, Score 2-10 levels, 1-64 questions per request. Choice and Score return the full probability map, so top-3 alternatives come free. Noul returns P(yes) only, as Jev's does. | [Workers AI schema](https://developers.cloudflare.com/workers-ai/models/clef/) |
| Benchmarks | n/a | Cloudflare's internal 41-benchmark "Decision Index" run: mixed. Clef wins on intent classification (BANKING77, CLINC150) and loses on reasoning (GPQA, MMLU-Pro, BBH). The Jev version tested is not stated, and there is no recipe or extraction benchmark. | [model card](https://huggingface.co/Cloudflare/clef) |
| Price (input; output free) | $0.042/M | Clef $0.240/M; Clef-omni $0.150/M; Clef-flash $0.038/M; a free tier of 10,000 neurons a day (about 140 Clef or 900 Clef-flash line requests) | [typesafe models](https://docs.typesafe.ai/models.md), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Per recipe (15 lines, about 50k tokens) | about 0.2p | Clef about 1p, Clef-flash about 0.2p. The 2,000-request daily cap would cost at most about $1.60 a day on Clef. | arithmetic |
| Context | 64k per request | Hosted Clef 64k; hosted Clef-flash 24k (cut from 64k on 2026-10-09); self-hosted defaults to 16k. Our largest request is 7.4k. | [changelog](https://developers.cloudflare.com/changelog/post/2026-10-09-clef-omni-workers-ai/) |
| Model pinning | Exact versioned id | Unversioned `@cf/cloudflare/clef` and `@cf/cloudflare/clef-flash`. Price and context changed under the same id in week one. Deprecated Workers AI models have been auto-aliased to successors. Open weights can be pinned by Hugging Face commit only if self-hosted. | [changelog](https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/) |
| Determinism | Choices identical across repeats in our spike | Hosted: byte-identical answers and probabilities across repeats (12 requests) | hands-on |
| UK English, metric | Nothing published | Nothing published. In the local run both Clef models got all 7 unit-system lines (UK/US/AU) right, as Jev did. | hands-on |
| Licence and hosting | Closed SaaS | Apache-2.0 weights. Self-hosting needs a GPU: Cloudflare tested on an H200; Clef-flash in BF16 fits a 48 GB L40S. That is far beyond the £2 a month hosting budget, so in practice it means Workers AI. | [model card](https://huggingface.co/Cloudflare/clef) |
| Data location | US (TypeSafe) | Workers AI does not support Regional Services, so there is no UK or EU-only processing | [data localisation](https://developers.cloudflare.com/data-localization/compatibility/) |
| Lock-in | One vendor, closed weights | Same request schema on Jev, Workers AI and self-hosted SGLang. Open weights are a real exit. | blog, model card |
| Fine-tuning | none | "RL for Calibrated Decisions" exists, but only as hands-on work with Cloudflare engineers; 37 golden lines is far too small to use it | [blog](https://blog.cloudflare.com/clef-decision-models/) |

Not verified: a Clef-specific rate limit (the "Text Generation" default of 300 requests a minute is a guess; 47 sequential requests hit no 429). The envelope, determinism and UK latency are now measured; see "Hosted run".

## Fit with the pipeline

- **Stage modes and gates** carry over unchanged, because they are model-agnostic configuration. Clef's lower confidences mean every gate would be re-tuned on held-out, and the spec already requires that for any model change.
- **Stored answers and review alternatives** work as they are, because Choice returns the full probability map.
- **Cassettes** are keyed by framing version, model pin and request hash. That works, but with an unversioned hosted id a recorded cassette can silently stop matching live behaviour. Running hosted Clef would need a scheduled live dev-set canary, or self-hosting.
- **Partial runs and the spend guard** are unchanged in shape. The cap's money basis would change, because Clef costs about 5.7x more per request.
- **Using both by stage** is technically easy, since it is one request format. It is not worth it on this evidence. The one stage where Clef clearly helped, extraction, is the per-line request that carries most of the tokens, so splitting stages would add a second vendor without saving anything.

## Recommendation

**Revised 2026-10-13, after reconciling with Cloudflare's post. The owner prefers Cloudflare and accepts the higher cost. On that basis, switch the V0.1 build from Jev to hosted Clef (27B, `@cf/cloudflare/clef`). One condition: the owner accepts the daily dev-set canary above in place of the exact-model pin.** That condition changes a spec rule and is hard to undo once cassettes and engine versions are keyed on it, so it is the owner's call. The model choice itself is easy to undo, because Jev and Clef take the same request body.

The reconciliation makes the case stronger than the first hosted write-up did:
1. Hosted Clef's top answers are as good as Jev v2's, and better on extraction, the stage with most of the decisions.
2. Measured the same way as Jev, its confidences are close to Jev's: 71% of extraction lines auto-accepted at 0.6 with none wrong, against Jev's 76%. The "underconfident hosted Clef" finding is withdrawn; it came from comparing two formulas.
3. Hosted answers and probabilities are deterministic, which is what makes a fingerprint canary a workable substitute for a pin.
4. It is slower than Jev (about 0.5 s against 0.3 s per request from the UK), mostly in a fixed overhead inside Cloudflare. With a kept-alive client and 8 requests in parallel, a 15-line import still fits well inside the 8 s budget.

New conditions from this round:
- **The engine computes confidence from `probabilities`** with one formula (Jev's), stored in engine config, and never reads the provider's `confidence` field. Gates tuned on one formula are meaningless under another.
- **The canary fingerprint covers the probabilities as well as the choices,** so a serving change that moves confidences without moving answers is still caught.
- **The client keeps connections alive,** and the request timeout rises from 2 s to about 5 s.

Unchanged:
- The flip of each stage to `auto` still waits for the owner's blind check of the held-out labels ([Rerun Jev v2 on the held-out golden lines](https://github.com/Ed-Barnes937/FindersEaters/issues/19)) and a held-out run, now against hosted Clef, under the pass rule in `docs/research/golden-set.md`.
- Gates are re-tuned for Clef on held-out. On dev they look close to Jev's.
- If hosted Clef fails held-out where Jev would pass, switching back is a configuration change.

Do not use Clef-flash or Clef-omni: both are cheaper, and Clef-omni is faster, but their extraction is too weak with the v2 template, and Clef-omni is confidently wrong on pack sizes and conversions.

If the owner declines the canary, stay with Jev as specified.

## What a switch would change (not applied)

Measured on the hosted run: the response envelope is `{result, success, errors, messages}`, the body sends `"model": "clef"`, the URL contains the account ID (keep it out of logs), and a 2 s timeout is too short.

- **[Jev client with recorded cassettes and stage modes](https://github.com/Ed-Barnes937/FindersEaters/issues/41)**: endpoint, auth header and model id come from configuration. It must unwrap the `result` envelope, compute confidence from `probabilities` with one configured formula instead of reading the provider's field, keep connections alive, Cloudflare's error and retry codes replace 429 and 529, the timeout rises to about 5 s, and the cassette key uses the Workers AI id plus the canary fingerprint. It is a good idea to make the base URL and model id configuration now, whichever model ships.
- **[Engine skeleton: pipeline, output type, versioning and the golden-set harness](https://github.com/Ed-Barnes937/FindersEaters/issues/40)**: the harness records the model id, the confidence formula and the answer fingerprint (choices and probabilities), the engine version covers a model swap, and the daily dev-set canary job is added here or as a new ticket.
- **[Engine recipe level: tags, derived diet, yield and time; golden pass rule in CI](https://github.com/Ed-Barnes937/FindersEaters/issues/44)**: Noul thresholds for the multi-valued tags are re-tuned per value, because Clef's method Nouls failed at 0.5.
- **[Lazy completion, batch re-parse, projection rebuild and Jev spend guard](https://github.com/Ed-Barnes937/FindersEaters/issues/47)**: the daily cap is re-based on Clef's price and the free-tier neuron count.
- **[Provisioning wizard for staging and production (owner runs it)](https://github.com/Ed-Barnes937/FindersEaters/issues/35)** and **[Docker image, Fly config, release step and /health](https://github.com/Ed-Barnes937/FindersEaters/issues/34)**: the secret `TYPESAFE_API_KEY` becomes a Cloudflare account ID and token.
- **[Go-live: production release, library import and owner reviews](https://github.com/Ed-Barnes937/FindersEaters/issues/64)**: the stage-mode flips come from the Clef held-out result.
- **Specs**: `engine-pipeline.md` section 4 (model pin), `operations.md` (secrets), and `v0.1.md` 17.6 (spend cap).
