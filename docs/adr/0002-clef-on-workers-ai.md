# Clef 27B on Workers AI as the engine's decision model, with a daily canary in place of an exact model pin

- **Status:** accepted (owner decision, 2026-10-13, on the evidence of [Spike: Clef as an alternative to Jev](https://github.com/Ed-Barnes937/FindersEaters/issues/65))
- **Date:** 2026-10-13

The engine's typed questions (Choice, Noul, Score over candidates code built) go to Cloudflare's **Clef**, the 27B model, hosted on Workers AI as `@cf/cloudflare/clef`, instead of Jev. Cloudflare publishes no versioned or pinnable Clef ids, so the spec's rule that the engine names an exact model id is replaced by a **canary**: a CI job, daily and before every release, sends the dev golden requests to the hosted model and compares a SHA-256 fingerprint of the answers and their probabilities with the one stored in engine configuration, opening an issue on a mismatch.

## Context

- On the dev golden lines, hosted Clef matched or beat Jev v2 where most decisions sit: extraction all fields 0.97 against 0.92, kind 1.00 against 0.95. It was slightly worse on segment role, compound and resolution, with all but one of those misses below 0.6 confidence. Evidence: `docs/research/clef-vs-jev.md`.
- Its answers and probabilities were byte-identical across repeats, which is what makes a fingerprint a usable stand-in for a version id.
- Its `confidence` field uses a different formula from Jev's. Measured with Jev's normalised formula from the returned `probabilities`, it auto-accepts 71% of extraction lines at 0.6 with none wrong (Jev 76%).
- It is slower from the UK (p50 about 0.5 s, p95 up to 1.4 s, max 2.4 s, against Jev's 0.3 s) and costs about 5.7x Jev per input token, about 1p per recipe. The owner prefers Cloudflare as a company and accepts the cost.
- Within two weeks of release the same Workers AI ids had a price cut, a context cut and a serving change. An exact pin cannot be had from the hosted service.

## Decision

- **Model.** Hosted Clef 27B, `@cf/cloudflare/clef`. The client takes its base URL and model id from configuration, so a model swap is a configuration change and a new engine version.
- **Confidence is the engine's own.** The engine computes every confidence from `probabilities` with one formula held in engine configuration, Jev's normalised form (p_max - 1/n)/(1 - 1/n), and never reads the provider's `confidence` field. Gates are only meaningful under that one formula.
- **Client.** Unwraps Workers AI's `{result, success, errors, messages}` envelope, keeps connections alive, has a timeout of about 5 s, and keeps the account ID (which is in the URL) out of logs.
- **Canary instead of a pin.** Engine configuration stores the model id plus the answer fingerprint (choices and probabilities, canonicalised). Both feed the engine version and the cassette key. The canary runs the dev golden requests live once a day and before every release; on a mismatch it fails and opens an issue with per-stage scores and the changed answers. Production keeps running, but a release waits until the fingerprint is re-baselined. Re-baselining the fingerprint is a new engine version and requires a golden-set rerun under the pass rule; any stage that no longer passes goes back to `review-first`.
- **Unchanged.** The v2 framing, the decision ladder, `review-first` for every model-backed stage until the held-out run, the pass rule and the gate rules in `docs/research/golden-set.md`.

## Considered options

- **Stay with Jev.** It is cheaper, faster and offers exact model ids. Rejected because Clef is at least as accurate on the stage that carries most decisions, the owner prefers Cloudflare, and the two services take the same request body, so returning to Jev stays a configuration change if Clef fails held-out.
- **Clef-flash (9B).** About Jev's price. Rejected: extraction 0.66 on dev, repeating the pack-size and conversion misses the v2 framing fixed for Jev.
- **Clef-omni (30B mixture of experts).** Faster than Clef and resolves well. Rejected: extraction 0.57, and it auto-accepted five wrong extraction lines at 0.6, so it is confidently wrong where it matters.
- **Self-hosting the open weights for a real pin.** The only way to pin Clef exactly. Rejected: a GPU host for a 27B model costs far more than the whole app (the spike judged it out of budget). Revisit if the canary fires often.

## Consequences

- A serving change can go unnoticed for up to a day. For a household app where every flagged decision is reviewed, that is acceptable.
- CI needs the Cloudflare account ID and a Workers AI token as repository secrets; each Fly app needs them in place of the Jev key. The canary costs about $0.04 a run.
- The daily spend cap stays a request count; at Clef's price 2,000 requests is about $1.60 a day.
- The held-out run that flips stages to `auto` and tunes gates now runs against hosted Clef, still after the owner's blind check of the held-out labels. Jev can be run alongside as a baseline.
- Cassettes recorded under one fingerprint are invalid under another, so a canary mismatch also means re-recording cassettes.
