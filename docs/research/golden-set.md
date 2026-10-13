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

## Not done: the Jev rerun (owner run, prepared 2026-10-13)

The rerun needs `JEV_API_KEY` and Ed's check of the agent's labels, so it is an owner task. Tracked on [Rerun Jev v2 on the held-out golden lines](https://github.com/Ed-Barnes937/FindersEaters/issues/19). Everything that could be done without the key is done.

### What was prepared (agent-decided, reversible)

- **Tags graded against the V0.1 taxonomy.** `run_spike.py --taxonomy v01` reads dimensions, questions and definitions straight from `docs/spec/tag-taxonomy.md` and gives them to Jev, so the asked text and the graded text cannot drift. Single-valued dimensions (cuisine, method, effort) are one Choice with `none`. Multi-valued ones (meal, protein, carb, equipment) are one Noul per value. Diet is derived, so it is not asked. `--taxonomy phase2` (the default) keeps the old vocabulary so phase 2 results still rescore.
- **`expected_v01` on all 20 recipes** in `golden.json`. Single-valued dimensions expect exactly one value. `near` lists near misses (shakshuka's `middle_eastern`, chilli's `american`, adjacent effort levels): they are reported in their own column but scored wrong, so the headline number is strict. R02 expects `north_african` and R03 expects `slow_cook`, as the taxonomy says. Notable relabels from the phase 2 `expected`: stroganoff is `central_eastern_european`, Victoria sandwich and cookies are `baking` (not dessert), chilli and jalfrezi carry `rice` because "serve with rice" is a carb base, and every recipe now has `equipment`.
- **The report now shows** accuracy and auto-accept share at gates 0.6 and 0.8 side by side, and a calibration table (accuracy per confidence band, per stage; bands [0,0.5) [0.5,0.6) [0.6,0.8) [0.8,0.95) [0.95,1] so they merge back to phase 2's three). Checked offline with `--rescore` on synthetic answers.

### Owner checklist

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

## Role in the product (agent-decided, reversible)

The golden set becomes the engine's regression suite. When the engine is built, move it next to the engine code and keep the `set` split. dev tunes framing and thresholds. heldout reports accuracy and is never tuned on. Every user correction to a line is a candidate golden line, which is how the household's own recipes join the set over time.
