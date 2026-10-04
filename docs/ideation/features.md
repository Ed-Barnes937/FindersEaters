# Features

Scored 2026-09-25. The reasoning behind each area lives in [README.md](README.md).

- **V1** is how important the feature is for the first version (5 = the app is
  pointless without it).
- **Cx** is complexity (5 = hardest). Time cost is deliberately ignored.
- **⚑** marks a foundation: it may ship after V1, but the data model has to
  allow for it from the start because it would be expensive to retrofit.

## Recipe engine

| Feature | V1 | Cx | Notes |
|---|---|---|---|
| Parse lines into ingredient, quantity, unit, prep | 5 | 4 | The core of the product |
| Canonical measure per ingredient, with conversions | 5 | 4 | Seed from Intake24 (UK portions) and USDA SR Legacy (densities) |
| Keep original text, allow re-parsing | 5 | 1 | |
| Classify lines: quantified, unquantified, not an ingredient | 4 | 2 | A natural Jev task |
| Scale by servings or multiplier, flag unclean scaling | 4 | 2 | Flagging is harder than scaling |
| Auto-tag across fixed dimensions | 5 | 3 | Designing the taxonomy is harder than applying it |
| Ingredient hierarchy, with derived dietary tags ⚑ | 3 | 3 | Seed from the Open Food Facts taxonomy, which is shallow in places |
| Sub-recipes and components ⚑ | 2 | 4 | Batch sauces, leftovers chains |
| Active vs waiting time, make-ahead steps | 2 | 3 | |

## Import

| Feature | V1 | Cx | Notes |
|---|---|---|---|
| URL import, including share-to-app on mobile | 5 | 3 | Captured on the device because some sites block server fetches. iPhone uses a Shortcut until Capacitor |
| Cookbook page scanning | 5 | 4 | OCR quality and layout variety stress the engine hardest |
| Review and correct a parsed recipe | 5 | 3 | The engine will make mistakes, so fixing them must be easy |
| Manual entry | 4 | 2 | |
| Cookbook barcode import | 1 | ? | Spike first. Likely index-only or not possible |

## Library

| Feature | V1 | Cx | Notes |
|---|---|---|---|
| Recipe list and recipe view | 5 | 1 | |
| Favourites | 5 | 1 | |
| Personal layer: rating, notes, times cooked ⚑ | 3 | 1 | Household-level. Separate from the recipe so stock recipes can carry it |
| Provenance (book and page, URL, personal) | 3 | 1 | |
| Similar recipes on each recipe | 4 | 3 | |
| Link packs: one-tap import of curated themed recipe links | 4 | 3 | Replaces a hosted stock library. Imported per user, never hosted |
| Agent curation and health checks for link packs | 4 | 2 | Find, parse-check and terms-check links; catch breakage |

## Search

| Feature | V1 | Cx | Notes |
|---|---|---|---|
| Filter by tag, ingredient, time | 5 | 2 | |
| One query language under search, collections, rules ⚑ | 4 | 4 | V1 UI can be plain filters, but they should compile to the query model |
| Natural language in, editable chips out | 3 | 3 | |
| Semantic / vibe search ("cosy", "summery") | 3 | 3 | |
| Saved queries as smart collections | 2 | 1 | Nearly free once the query language exists |
| Relational search ("like this but vegetarian") | 2 | 3 | |
| "What can I make with…" | 2 | 2 | |

## Planning and suggestions

| Feature | V1 | Cx | Notes |
|---|---|---|---|
| Plans as recipe lists keyed by date, optional days | 5 | 1 | |
| Suggestions from chosen recipes (anchors) | 5 | 3 | The payoff of the whole product |
| Weight ingredient overlap by distinctiveness | 4 | 2 | Shared salt is worth nothing |
| Treat the week as a set (variety) | 4 | 3 | Stops three pasta bakes |
| Soft signals: favourites, effort, overlap | 4 | 3 | |
| Reason shown with every suggestion ⚑ | 4 | 2 | Scoring must be decomposable into reasons from day one |
| Hard rules as queries with limits ⚑ | 3 | 3 | Depends on the query language |
| Dismiss with a reason ("not this week", "never") | 3 | 2 | |
| Leftovers as plan items | 3 | 2 | |
| Presets ("Easy week", "Cheap week") | 2 | 2 | |
| Learned per-recipe cadence | 2 | 3 | Needs plan history to exist first |

## Shopping list

| Feature | V1 | Cx | Notes |
|---|---|---|---|
| Generate from a plan, merging quantities | 5 | 3 | Relies on canonical measures |
| Tick off items | 5 | 1 | |
| "Always have" items start ticked | 5 | 1 | |
| Group by aisle | 3 | 2 | The ingredient hierarchy helps |
| Round to buyable amounts | 2 | 3 | Needs pack size data |

## Household and platform

| Feature | V1 | Cx | Notes |
|---|---|---|---|
| Default servings | 4 | 1 | |
| Preferred units and locale | 4 | 2 | US vs UK cups and pints, AU tablespoons. UK default |
| Location selection (ingredient names, link packs, food data) | 2 | 3 | UK is the default until this exists |
| Household sharing: one library and plan, several people ⚑ | 4 | 3 | Shapes accounts and data ownership |
| Household members: people who eat, separate from accounts | 2 | 2 | Post-V1. Plans store servings directly, so members can derive them later |
| Choose who's eating for a plan | 1 | 2 | Post-V1, depends on members |
| Member weekday presence (usual pattern, plus per-plan overrides) | 1 | 2 | Post-V1. Only precise when a recipe has a day assigned |
| Per-member favourites and dislikes | 1 | 2 | Post-V1, depends on members |
| Sync across devices | 4 | 3 | |
| Shopping list works offline | 4 | 3 | Shops have poor signal |
| "What we plan" setting (e.g. 1 hot meal a day) | 3 | 1 | |
