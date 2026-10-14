# Golden set: held-out lines

Date: 2026-10-13. Ticket: [Build a golden set from the household's own recipes](https://github.com/Ed-Barnes937/FindersEaters/issues/4).

## What exists now

The golden set stays in one file, `docs/ideation/research/jev-spike/golden.json`. Every line and recipe now has a `set`:

- **dev**: L01-L44 and R01-R03, unchanged. The Jev v2 framing was written after seeing their misses, so they cannot confirm v2 on their own. Entries with no `set` field are dev.
- **heldout**: L45-L194 and R04-R20, added 2026-10-13. Nobody has tuned anything on them yet.

Each held-out line also carries `recipe` (the recipe it came from) and `capture` (`json-ld`, `html` or `manual`). Each held-out recipe carries `source`, `capture` and, where it matters, `dietary` (what the hierarchy should derive and why). The spike runner takes a new `--set dev|heldout|all` flag. A throwaway script generated the held-out entries, but the JSON is now the source of truth, so edit it directly.

### Counts (held-out)

| | n |
|---|---|
| Lines | 150 (146 ingredient, 2 header, 2 note) |
| Compound split | 137 single, 5 compound, 4 alternatives |
| Kind | 128 quantified, 17 unquantified, 1 not_ingredient |
| Lines scored on extraction | 136 |
| Lines with KB resolution | 65 (4 candidates + none, generic parents included) |
| Lines with unit system | 10 (5 us_customary, 5 metric_cup) |
| Recipes with tags | 17 |
| Capture | 138 JSON-LD, 2 HTML (section headers), 10 manual |
| Sources | BBC Good Food 80, RecipeTin Eats 29, Jamie Oliver 21, NYT Cooking 10, household notes 10 |

The dev set has 44 lines and 3 recipes, so the whole set is 194 lines and 20 recipes.

## Where the recipes came from (agent-decided, reversible)

The ticket asked Ed for 15-25 of the household's own recipes. This was an unattended run, so the agent picked 16 public recipes that a UK household plausibly cooks and that cover the 22 recipe types, plus one synthetic set of terse household notes (R20, marked `synthetic: true`). The recipe text is the site's JSON-LD `recipeIngredient`, fetched on 2026-10-13. That is what an import would send to the engine, which matters more for a regression suite than whose kitchen the recipe came from. Ed can swap in his own recipes at any time. Add them as more held-out entries. Don't replace these.

| Type | Recipe |
|---|---|
| 1 US measures | R06 NYT chocolate chip cookies (cups, sticks, ounces, pounds) |
| 2 Australian | R07, R08 RecipeTin Eats (metric cups). **Gap**: no 20ml tablespoon line, see below |
| 3 UK baking | R05 Victoria sandwich |
| 4 ranges, fractions, pinch/knob | R04, R07, R09, R10, R15, R19 |
| 5 soup, to taste, stock cube | R09 leek and potato soup, R04, R08 |
| 6 tins | R04, R10, R12, R13, R15 |
| 7 sections | R10 jalfrezi (two sections), R09 (garnish) |
| 8 stir fry, alternatives | R07 chop suey, R08 |
| 9 spice list, whole and ground | R10 jalfrezi, R11 biryani |
| 10 own notes | R20 shepherd's pie (synthetic) |
| 11 BBC Good Food | R04, R05, R09, R10, R11, R15-R19 |
| 12 other UK site | R12-R14 Jamie Oliver |
| 13 long-preamble blog | R07, R08 RecipeTin Eats |
| 14 US site | R06 NYT Cooking |
| 15 weeknight pasta | R13 chickpea arrabbiata |
| 16 roast | R14 roast chicken (1.6kg) |
| 17 fish | R12 fish parcels |
| 18 vegetarian and vegan | R13 (labelled vegetarian, but Parmesan), R15 vegan chilli, R16 |
| 19 side | R18 egg-fried rice, R19 naan |
| 20 batch cook | R04 chilli, R15 |
| 21 no-cook salad | R16 Greek salad |
| 22 dessert, breakfast | R05, R06; R17 pancakes |

## Labelling rules added (agent-decided, reversible)

These sit on top of the README's engine grading rules.

1. **Label the captured text.** The golden line is the JSON-LD string as delivered, double spaces and broken punctuation included, because that is what the engine receives.
2. **Implicit quantity is null.** In "400g can plum tomatoes", "small cinnamon stick" and "handful of ...", quantity is null. Code supplies 1 when it canonicalises.
3. **Arithmetic quantities.** For "2 cups minus 2 tablespoons", the main amount goes in quantity and unit, and the rest goes in note. A deterministic rule has to combine them, because Jev can't do arithmetic. Scaling is wrong until that rule exists.
4. **Alternatives in brackets are notes.** "1 tsp sugar (or ... dark chocolate)" and "light soy sauce (, or all purpose soy)" are single lines with a note. Only a bare "X or Y" in the name is `alternatives`.
5. **Slash synonyms are single.** For example "baking soda / bi-carb" and "scotch fillet steak / boneless rib eye".
6. **Brands are accepted in the ingredient or the note** ("Mutti chopped tomatoes"). "Oxo" resolves to the beef stock cube, so the KB needs brand synonyms.
7. **Resolve from the line alone.** "mince" resolves to generic mince. Lamb is also accepted, but recipe context isn't required. "turmeric" resolves to ground turmeric, following UK convention. That is a judgement call.
8. **The tap-water rule applies.** "3/4 cup (185 ml) water" is not_ingredient.

## Capture findings (observed 2026-10-13)

These feed the import capture contract, which the map lists under "Not yet specified".

- **BBC Good Food JSON-LD drops the comma between ingredient and prep.** It gives "4 eggs beaten" and "lime wedges guacamole, rice and coriander to serve". Segmentation and compound splitting get harder, and serving lists run together.
- **BBC Good Food JSON-LD drops section headers.** The jalfrezi's "For the sauce" and "For the meat & veg" only appear in the page HTML, so the JSON-LD lists ground cumin, coriander and turmeric twice with no context. The soup's garnish leek is the same. schema.org `recipeIngredient` is a flat list, so if sub-recipes matter, capture must also carry the HTML ingredient block or its headings.
- **RecipeTin Eats (WP Recipe Maker) JSON-LD has broken brackets and dual units.** For example "(, thinly sliced)", "((Note 1))" and "600 g / 1.2 lb". Its cups are metric (185 ml for 3/4 cup).
- **Which sites served a plain server fetch:** BBC Good Food, Jamie Oliver, RecipeTin Eats and NYT Cooking all served full JSON-LD to a server fetch with a browser user agent. Serious Eats and Allrecipes (Dotdash Meredith) and taste.com.au returned small bot-block pages. Those sites need device-side capture.
- **The Australian 20ml tablespoon is untested.** taste.com.au blocked the fetch, and the spike's unit-system probe only asks about cups and pints. A tablespoon line from an AU site is 33% larger than the same line from a UK site. The units work needs a rule for it, probably by source domain, the same way phase 2 found a domain rule matches Jev on cups.

## Dietary probes

- R13 is labelled vegetarian by Jamie Oliver, but its Parmesan uses animal rennet. Derivation must not trust site labels.
- R16's feta depends on the product. The hierarchy needs an "unknown" state, not a guess.
- R15 is fully vegan.

## The held-out run (prepared 2026-10-13, run 2026-10-14)

Tracked on [Run hosted Clef 27B on the held-out golden lines](https://github.com/Ed-Barnes937/FindersEaters/issues/19). The owner signed off the held-out labels as they stand on 2026-10-13, and that sign-off was recorded on the ticket before any model saw a held-out line. The engine moved from Jev to hosted Clef 27B in between (`docs/adr/0002-clef-on-workers-ai.md`), so the run measured Clef. The result and the stage verdicts are in [Held-out result: hosted Clef 27B](#held-out-result-hosted-clef-27b-2026-10-14) below.

### What was prepared (agent-decided, reversible)

- **Tags graded against the V0.1 taxonomy.** `run_spike.py --taxonomy v01` reads dimensions, questions and definitions straight from `docs/spec/tag-taxonomy.md` and gives them to Jev, so the asked text and the graded text cannot drift. Single-valued dimensions (cuisine, method, effort) are one Choice with `none`. Multi-valued ones (meal, protein, carb, equipment) are one Noul per value. Diet is derived, so it is not asked. `--taxonomy phase2` (the default) keeps the old vocabulary so phase 2 results still rescore.
- **`expected_v01` on all 20 recipes** in `golden.json`. Single-valued dimensions expect exactly one value. `near` lists near misses (shakshuka's `middle_eastern`, chilli's `american`, adjacent effort levels): they are reported in their own column but scored wrong, so the headline number is strict. R02 expects `north_african` and R03 expects `slow_cook`, as the taxonomy says. Notable relabels from the phase 2 `expected`: stroganoff is `central_eastern_european`, Victoria sandwich and cookies are `baking` (not dessert), chilli and jalfrezi carry `rice` because "serve with rice" is a carb base, and every recipe now has `equipment`.
- **The report now shows** accuracy and auto-accept share at gates 0.6 and 0.8 side by side, and a calibration table (accuracy per confidence band, per stage; bands [0,0.5) [0.5,0.6) [0.6,0.8) [0.8,0.95) [0.95,1] so they merge back to phase 2's three). Checked offline with `--rescore` on synthetic answers.

### Owner checklist (done 2026-10-13 and 2026-10-14)

1. Spot-check the agent's labels: the 136 extraction-scored and 65 resolution lines (held-out, L45-L194), and `expected_v01` on R01-R20. Fix in `golden.json` before running, never after seeing results.
2. Optionally add household recipes as more `heldout` entries (same shape, `"set": "heldout"`).
3. Run, from `docs/ideation/research/jev-spike`:
   ```
   python3 run_spike.py --framing v2 --set heldout --taxonomy v01   # the measurement, about $0.03
   python3 run_spike.py --framing v2 --set dev --taxonomy v01       # R01-R03 on the new tags, about $0.01
   ```
4. Record per stage against the phase 2 v2 column in `docs/ideation/research/jev-capabilities.md`: accuracy, acc@0.6 and acc@0.8, auto-accept share at both gates, the calibration bands, and any new failure patterns. Then update that file's "Revised stage verdicts" table.

### How to read the result (agent-decided, reversible)

- **v2 holds** if each stage's held-out accuracy is within about 5 points of its phase 2 v2 dev number, and acc@0.8 stays at or above 0.95 for the stages the engine auto-accepts. 150 lines give roughly a plus or minus 4 point margin at 90% accuracy, so smaller gaps are noise.
- **A stage that drops more than that** keeps its review-first default in the engine and goes back to framing work on dev lines only. Held-out lines are never tuned on.
- **Tags** are judged per dimension. A dimension whose acc@0.8 is below 0.9 ships as a suggestion in the review screen, not an applied tag, which is already the taxonomy's unknown-is-better-than-wrong rule.

## Held-out result: hosted Clef 27B (2026-10-14)

**Run.** `@cf/cloudflare/clef` on Workers AI, v2 framing, `--taxonomy v01`, confidence computed from `probabilities` with the Jev formula, one kept-alive connection. All 150 held-out lines and 17 held-out recipes, plus the dev set on the V0.1 tags for comparison. No Jev baseline: no Jev key was available. Code, raw JSONL and summaries are on [`spike/clef`](https://github.com/Ed-Barnes937/FindersEaters/tree/spike/clef/docs/ideation/research/jev-spike/results) (`*-heldout-v2-v01*`, `*-dev-v2-v01*`, `summary-clef-hosted-workers-ai-*-v01.txt`). The guard that keeps non-Jev models off held-out was lifted for this one run with an explicit `--sanctioned-heldout-run` flag. The dev answers were identical to the 2026-10-13 run, so the canary fingerprint would have held.

**Comparator.** The pass rule names the phase 2 v2 dev number. The engine now runs Clef, so each stage is held to Clef's own dev number (same model, same templates) and also shown against Jev v2's. Every verdict comes out the same under either comparator.

### Line stages

| Stage | n | Jev v2 dev | Clef dev | Clef held-out | acc@0.6 / auto@0.6 | acc@0.8 / auto@0.8 | Verdict |
|---|---|---|---|---|---|---|---|
| Segment: role | 150 | 1.00 | 0.93 | **0.99** | 1.00 / 0.95 | 1.00 / 0.89 | **Pass.** `auto`, gate 0.8 |
| Segment: structure (single / compound / alternatives) | 146 | 1.00 | 0.97 | **0.88** | 0.90 / 0.88 | 0.92 / 0.57 | **Fail** (down 9 points, acc@0.8 below 0.95). `review-first` |
| Classify kind | 146 | 0.95 | 1.00 | **0.95** | 0.99 / 0.94 | 0.99 / 0.85 | **Pass** (down 5, at the margin). `auto`, gate 0.8 |
| Extract, all six fields | 136 | 0.92 | 0.97 | **0.80** | 1.00 / 0.54 | 1.00 / 0.30 | **Fail** (down 17). `review-first` |
| Extract: ingredient span cross-check | 136 | 0.95 | 0.97 | 0.97 | 1.00 / 0.74 | 1.00 / 0.51 | Part of extract |
| Resolve ingredient | 65 | 1.00 | 0.94 | **0.95** | 1.00 / 0.88 | 1.00 / 0.68 | **Pass.** `auto`, gate 0.8 |
| Resolve unit system | 10 | 1.00 | 1.00 | **1.00** | 1.00 / 0.90 | 1.00 / 0.50 | **Pass.** `auto`, gate 0.8 |

Extract per field on held-out: quantity 0.93, unit 0.93, size 0.93, ingredient 0.92, prep 0.97, note 0.88. Calibration bands (accuracy, held-out):

| Stage | [0,0.5) | [0.5,0.6) | [0.6,0.8) | [0.8,0.95) | [0.95,1] |
|---|---|---|---|---|---|
| Segment | 0.59 (17) | 1.00 (8) | 0.89 (54) | 0.95 (146) | 1.00 (71) |
| Classify | 0.20 (5) | 0.75 (4) | 0.92 (13) | 0.98 (57) | 1.00 (67) |
| Extract (per token) | 0.73 (389) | 0.93 (151) | 1.00 (286) | 1.00 (375) | 1.00 (23) |
| Resolve | 0.33 (3) | 0.83 (6) | 1.00 (17) | 1.00 (40) | 1.00 (9) |

Latency with a kept-alive connection: p50 464 ms, p95 1.0 s, max 1.7 s. Held-out requests averaged about 4.2k input tokens (RecipeTin Eats lines are long), so a 15-line recipe is nearer 65k tokens, about 1.5p, than the 50k the spec assumed.

### What failed, and why

- **Extraction drops 17 points, but every miss is low confidence.** No extraction line at or above 0.6 was wrong (73 lines, 54%), or at or above 0.8 (41 lines, 30%). The 27 wrong lines all sat below 0.6 and fall into known patterns: RecipeTin Eats' broken bracketed notes ("(, or all purpose soy(Note 3))") leaking words into the ingredient (9 lines); pack sizes ("400g can", "142ml carton") read as quantity plus size (4); arithmetic quantities ("2 cups minus 2 tablespoons", 2); unit-like words read as quantities or missed ("Dash", "drop", "bay leaf", "small handful", "optional:", "1 Oxo"); and long BBC lines without commas (L145, L147, L160). Dev has almost none of these shapes, which is why the held-out number is lower. The 0.6 gate rule (acc@0.6 at least 0.95) is met, but it only applies to a stage that passes, and extraction does not.
- **Structure answers "alternatives" with confidence for bracketed "(or ...)" notes and slash synonyms.** Seven wrong answers at 0.8 or above (L55, L85, L87, L89, L92, L96, L180), all cases that labelling rules 4 and 5 call single. Clef is not told those rules. In the engine, structure is only asked when code finds a split point, so a split-point rule that ignores "or" inside brackets would remove most of them, but that is framing or rule work on dev lines only.
- **Classify's one confident miss is caught by a rule.** L88 "3/4 cup (185 ml) water" was read as quantified at 0.92. The engine's tap-water rule decides it before Clef is asked.
- **Resolution misses are all below 0.6:** L96 beef fillet for rib eye (0.42), L180 cumin seed for none (0.50), L189 "1 Oxo" as a chicken stock cube (0.30, needs the brand synonym rule 6 asks for). The UK senses hold: tomato purée resolves to `tomato_puree` (L37, 0.92) and cornflour to `cornflour` (L82, 0.97).

### Tags (per dimension)

Single-valued dimensions are Choices. Multi-valued ones are one Noul per value, scored here per value with confidence |2p - 1| (the Jev formula for two options).

| Dimension | Held-out acc | acc@0.8 | auto@0.8 | Verdict |
|---|---|---|---|---|
| Cuisine | 0.88 | 1.00 | 0.47 | **Applied** at 0.8, suggestion below |
| Method | 1.00 | 1.00 | 0.47 | **Applied** at 0.8, suggestion below |
| Effort | 0.59 | 1.00 (1 answer) | 0.06 | **Suggestion only.** One answer cleared 0.8, which is no evidence, and Clef says medium where the label says easy on 7 of 17 recipes |
| Meal (per value) | 0.98 | 0.99 | 0.75 | **Applied** per value at 0.8 (whole-set accuracy 0.82: pancakes as breakfast, egg-fried rice and naan as dinner) |
| Protein (per value) | 1.00 | 1.00 | 0.98 | **Applied** per value at 0.8 |
| Carb (per value) | 0.99 | 1.00 | 0.77 | **Applied** per value at 0.8 |
| Equipment (per value) | 1.00 | 1.00 | 0.98 | **Applied** per value at 0.8 |

Diet is derived, so it is not asked.

### Verdicts applied (agent-decided, reversible config)

- `auto` at gate 0.8: segment role, classify kind, resolve ingredient, resolve unit system.
- `review-first`: segment structure and extract. Their framing work goes back to dev lines only, and held-out stays untuned.
- Tags: cuisine, method, meal, protein, carb and equipment are applied at 0.8 and offered as suggestions below it. Effort is always a suggestion.
- The extraction gate stays 0.8 in config. It would drop to 0.6 only if extraction passes.

**Effect on review load.** Every quantified or unquantified ingredient line goes through Clef extraction, so with extraction `review-first` nearly every ingredient line is still a check line. The flips mostly clear headers, notes and recipe-level tag chips. Review load per recipe is close to what the review prototype measured for full review-first (about 7 taps for 17 lines).

**For the owner (not acted on).** The pass rule judges a stage on raw accuracy, but extraction's confidence separated right from wrong perfectly on held-out. A rule that judged auto-accept on acc@gate alone would let extraction run `auto` at 0.6, clearing about half of all ingredient lines silently with no wrong line on held-out. Changing the rule after seeing the result is what the rule was written to prevent, so it is the owner's call, not the agent's.

**Owner decision (2026-10-14): Extract runs `auto` at 0.6.** The pass rule is unchanged and Extract still fails it; the owner overrode the verdict for this one stage, for import UX (import should not need near-total confirmation), as reversible config. Lines at or above 0.6 (73 of 136 held-out lines, none wrong) apply silently; lines below get `low_confidence` check flags. Segment structure stays `review-first`. **This gate was chosen after seeing the held-out results, so it is a post-hoc setting, not a pre-registered pass**, and held-out is no longer independent evidence for it. The fresh evaluation set is the owner's corrections to silently applied extract lines from the library import on; Extract reverts to `review-first` when they exceed 2% of silently applied lines (counted from 150 lines, or at 4 corrections sooner), checked by the `extract-audit` command at the end of the library import and before each release to `main` (`docs/spec/engine-pipeline.md` section 4).

**Owner decision (2026-10-14, later): a random-sample audit replaces reading every line.** The owner does not read every ingredient line during the library import. Once the import is complete, the app draws 150 silently applied extract lines uniformly at random across the imported library (seeded and stored, so the sample is reproducible and fixed once drawn), and the owner marks each right or corrects it in a sample-check view; corrections are normal corrections, also tagged as audit results. 4 or more wrong out of 150 (more than 2%) reverts Extract to `review-first`; 0 wrong supports a true rate below 2% at about 95% confidence (rule of three); 3 wrong is borderline and the owner may draw a second sample of 150 before deciding. Corrections in normal use to silently applied extract lines still count toward the cumulative 2% trigger above. `extract-audit` reads both and prints `OK`, `REVERT` or `BORDERLINE`, and is still pasted into every release PR to `main`.

## Role in the product (agent-decided, reversible)

The golden set becomes the engine's regression suite. When the engine is built, move it next to the engine code and keep the `set` split. dev tunes framing and thresholds. heldout reports accuracy and is never tuned on. Every user correction to a line is a candidate golden line, which is how the household's own recipes join the set over time.
