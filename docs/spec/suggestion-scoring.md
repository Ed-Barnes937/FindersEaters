# Suggestion scoring and selection (V0.1)

Resolves [Design suggestion scoring and selection](https://github.com/Ed-Barnes937/FindersEaters/issues/12). Feeds the V0.1 spec (`docs/spec/v0.1.md`), [Prototype building a plan with suggestions](https://github.com/Ed-Barnes937/FindersEaters/issues/15) and [Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13). Builds on `docs/spec/query-model.md`, `docs/spec/tag-taxonomy.md` and `docs/spec/food-knowledge-base.md`.

Every decision here is agent-decided and reversible. Suggestions are never persisted, so the signals, weights and selection can all change in code without a data migration. The only data the planner needs (resolved ingredients, tags, favourites, cooking dates, always-haves) already exists for other reasons. Nothing was escalated.

## Summary

- The planner is a **pure function** in a shared package: `suggest(request, context) -> suggestions`. The server gathers the context with ordinary queries; the function does no I/O.
- **Two layers**: hard filters build the **candidate pool**, then soft signals rank it. In V0.1 the only hard filters are the request's query (meal types), "not already in the plan" and "not skipped". Rules are foundation-only and slot into the same layer later.
- **Five score terms**, each a signal in a fixed range times a fixed weight in code: **overlap** (+), **favourite** (+), **effort** (+/-), **recently cooked** (-) and **variety** (-). The score is exactly the sum of the terms.
- **Every term is a reason.** A suggestion carries its terms as structured reasons (kind, contribution, data); the client renders the text. Nothing is explained after the fact.
- **Set-aware greedy selection**: pick the best candidate given everything already in the plan plus the picks made so far, add it, repeat. Overlap and variety are both computed against that growing set, which is what stops three pasta bakes and what makes "uses the rest of the coriander" work between two suggestions.
- **Skip** ("show me another") removes one suggestion and re-picks that one slot with everything else held fixed.
- **Presets are out of V0.1** (per [Agree the V0.1 feature cut](https://github.com/Ed-Barnes937/FindersEaters/issues/2)). A preset later is a named weights override plus an optional extra query; nothing in this design blocks it.
- **Learned cadence is out**. V0.1 uses one default gap (28 days) for every recipe, which is the degenerate case of cadence; learned per-recipe gaps replace the constant later.

## 1. The request

```ts
type SuggestRequest = {
  planId: string
  groups: { query: QueryTree; count: number }[] // e.g. [{ query: meal:dinner, count: 5 }]
  pending: string[]   // recipe ids currently shown as suggestions and not skipped
  skipped: string[]   // recipe ids skipped in this planning session
  replace?: string    // recipe id being skipped: re-pick only this slot
}
```

- **Groups** carry "which meal types and how many" (from the feature cut). V0.1's UI sends one group, `meal:dinner` with a count it defaults from the plan's dated days (or 5). Sides are a separate group (`meal:side`) only when the request asks for them, per [Decide whether a plan item is one recipe or a meal](https://github.com/Ed-Barnes937/FindersEaters/issues/3).
- A group's `query` is any query tree, so the planner screen can narrow a request ("dinners under 30 minutes") with the same filter sheet as the Recipes screen. This is a request parameter, not a persisted rule.
- **Suggestions are not stored.** The client holds `pending` and `skipped` for the planning session. Accepting a suggestion creates a plan item, which from then on is an anchor. Reloading the page loses the skip list; that is acceptable for skip-only V0.1.

## 2. The candidate pool (hard layer)

A recipe is a candidate for a group when all of these hold:

1. It is in the household's library and matches the group's query (compiled by the query executor, so unknown meal type never matches).
2. It is not already a plan item in this plan, and not in `pending` (a recipe is never suggested twice in one plan; the household can still add it twice by hand, for example a double batch).
3. It is not in `skipped`.
4. (Foundation-only) It would not push any `max` rule over its limit given the plan plus picks so far. Rule membership comes from the same SQL executor as a set of recipe ids; the check is in memory. `max: 0` is a plain filter. `min` rules are handled after greedy selection by swapping the lowest-scoring pick for the best candidate that satisfies the rule; not built in V0.1.

Recipes awaiting review are candidates: the library does not hide them, so the planner does not either.

## 3. The context

What the server loads once per request, for the whole library (V0.1 libraries are 50-1,000 recipes, so this is small and in memory):

| Input | Per | Source |
|---|---|---|
| Ingredient set | recipe | Resolved ingredient ids of quantified and unquantified lines (not "not an ingredient" lines; unresolved lines contribute nothing) |
| Ancestor closure | ingredient | Knowledge base "is a" closure (the same one `ing:` uses); never "made from" |
| Tags | recipe | Effective `cuisine`, `protein`, `carb`, `method`, `effort` (after corrections) |
| Favourite | recipe | Personal layer |
| Cooking dates | recipe | Dates the recipe was or will be cooked, excluding this plan (source belongs to [Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13)) |
| Always-have | household | Always-have ingredient ids |
| Plan set | plan | Recipes of this plan's items (anchors), plus `pending` picks |
| Reference date | plan | The plan's earliest date, or today if the plan has no dated items |

## 4. Signals and weights

All weights are constants in one module. The score of candidate `c` against the set `P` (plan items plus picks so far) is:

```
score(c, P) = 1.0 * overlap(c, P)
            + 0.6 * favourite(c)
            + 0.3 * effort(c)
            - 0.5 * recentlyCooked(c)
            - 1.0 * variety(c, P)
```

### 4.1 Overlap, weighted by distinctiveness (0 to 1)

**Distinctiveness** of an ingredient `i` is how rare it is in this household's library:

```
df(i) = number of library recipes with a line resolving to i or any descendant of i
d(i)  = ln((N + 1) / (df(i) + 1)) / ln(N + 1)        N = library size, d in [0, 1)
```

Salt in 55 of 60 recipes scores about 0.02; fennel in 2 of 60 scores about 0.73. It is computed per request from the library, so it adapts as the library grows and needs no curation.

**A shared ingredient** is a pair (a line of `c`, a line of some recipe in `P`) where the two ingredients are the same or one is an "is a" ancestor of the other (`cheddar` matches `cheese`; `cheddar` does not match `red leicester`). Its weight is the distinctiveness of the more general of the two. Each ingredient counts once, however many plan recipes share it. **Always-have ingredients never count**: the household keeps them anyway, so sharing them saves nothing.

```
overlap(c, P) = min(1, sum of shared-ingredient weights / 1.5)
```

The cap of 1.5 means about two distinctive shared ingredients saturate the signal, so a recipe that shares eight common ingredients cannot outscore one that shares the fennel and the crème fraîche.

Overlap includes the main protein (sharing a pack of chicken thighs across two dinners is real value); the variety term pushes back when that makes the week samey. The two terms are meant to pull against each other.

### 4.2 Favourite (0 or 1)

1 if the recipe is a favourite in the personal layer. Times cooked and rating do not feed V0.1 scoring.

### 4.3 Effort (-1 to 1)

`easy` = 1, `medium` = 0, `hard` = -1, unknown = 0. V0.1 mildly prefers less hands-on work. A future "Easy week" preset raises this weight; a weekend-aware effort (hard is fine on a Saturday) needs dated suggestions and is not V0.1.

### 4.4 Recently cooked (0 to 1)

```
gap            = 28 days (one constant for every recipe in V0.1; learned cadence replaces it per recipe later)
nearest        = the cooking date closest to the reference date, in either direction
recentlyCooked = max(0, 1 - |reference date - nearest| / gap)      0 if never cooked
```

Looking in both directions means a recipe already in next week's plan is penalised when planning this week. It is a penalty, not a bonus for being "due", so it only appears as a reason when it matters, and a never-cooked recipe is neither boosted nor penalised.

### 4.5 Variety (0 to 1)

For each variety dimension, count the recipes in `P` that share a known value with `c`:

| Dimension | Weight | Shares when |
|---|---|---|
| `protein` | 0.30 | any common value |
| `carb` | 0.30 | any common value |
| `cuisine` | 0.25 | same value |
| `method` | 0.15 | same value |

```
variety(c, P) = sum over dimensions of weight * (1 - 0.5 ^ count)
```

One other pasta dish costs half the `carb` weight; two cost three quarters; it keeps rising, so a third pasta bake is penalised more than a second. Unknown never shares, and neither does `none` (two recipes with no carb base are not "the same carb"). User tags never feed scoring.

Known bias, accepted: a recipe with unknown tags escapes the variety penalty. Unknown beats wrong, and the review flow fills tags in over time.

## 5. Reasons

Every term with a non-zero contribution becomes a reason:

```ts
type Reason =
  | { kind: 'overlap'; contribution: number; shared: { ingredientId: string; withRecipeId: string }[] } // top 2 by weight
  | { kind: 'favourite'; contribution: number }
  | { kind: 'effort'; contribution: number; value: 'easy' | 'hard' }
  | { kind: 'recently_cooked'; contribution: number; date: string }
  | { kind: 'variety'; contribution: number; shared: { dimension: string; value: string; count: number }[] }
  | { kind: 'fresh'; contribution: 0; planEmpty: boolean } // fallback only
```

The sum of contributions equals the score, which a property test asserts.

**Display** (copy is the client's, these are the intended phrasings):

| Kind | Example |
|---|---|
| overlap | "Uses the rest of the fennel from Fennel and sausage pasta" (one ingredient) / "Shares fennel and crème fraîche with Fennel and sausage pasta" |
| favourite | "A favourite" |
| effort | "Easy" / "Hard: more hands-on" |
| recently_cooked | "Had it 10 days ago" / "Already planned for 21 Oct" |
| variety | "Another pasta dish" / "Third chicken dish this week" |
| fresh | "Different from the rest of the plan" / "A first pick: nothing to match yet" |

- The card shows the **top two positive reasons** with contribution at least 0.1, largest first.
- The detail view ("why this?") shows every reason, including penalties, with its sign.
- If no positive reason reaches 0.1, the card shows the **fresh** reason: "Different from the rest of the plan" when the plan is non-empty and variety is 0, otherwise "A first pick: nothing to match yet". It has zero contribution and is the only reason allowed to; it is true, and it is what the score actually says (nothing pulled this recipe up, nothing pushed it down). This guarantees every suggestion explains itself, including at cold start.

## 6. Selection

```
picks = []
for each slot across all groups, in request order:
  P = plan items + pending + picks
  best = argmax over the group's candidates (not yet picked) of score(c, P)
  ties broken by hash(planId, recipeId)
  picks.push(best with its reasons)
```

- **Greedy, set-aware** (the maximal marginal relevance pattern). Optimal set search is not worth it: suggestions are a starting point the household edits, and greedy is explainable one pick at a time.
- **Deterministic**: the same plan and request return the same suggestions, which makes tests and bug reports reproducible. The plan id in the tie-break hash means two plans with identical contents still differ; the recently-cooked penalty provides rotation across weeks.
- **Skip** (`replace` set): the skipped recipe joins `skipped`, `P` is the plan plus every other pending suggestion, and exactly one slot is re-picked. The other suggestions do not reshuffle under the household's thumb.
- **Accepting** a suggestion makes it a plan item. Pending suggestions are not re-scored on accept (the screen stays stable); the next skip or new request sees the new anchor.
- **Not enough candidates**: return as many as exist, and the response says how many the group asked for and how many the pool had, so the UI can say "only 3 dinners left to suggest".

Cost: library size times slots times plan size, all in memory, well under 50 ms for 1,000 recipes and 14 slots. The SQL work is the same few queries regardless of count.

## 7. Cold start

| Situation | Behaviour |
|---|---|
| Empty library, or empty pool for every group | No suggestions; the UI points to import. |
| No anchors | First pick ranks on favourite, effort and recently cooked only; later picks overlap with and vary against the earlier picks. |
| No plan history | Recently cooked is 0 everywhere; nothing breaks. |
| Very small library (under about 10 recipes) | Distinctiveness still works (smoothed); the pool simply runs out, reported as above. |
| No favourites, all tags unknown | Every term can be 0; ties fall to the hash; every card shows a fresh reason. Honest, if unexciting. |

## 8. Worked example

Library of 60 recipes. Plan has one anchor, **Fennel and sausage pasta** (fennel, sausages, pasta, parmesan, crème fraîche, garlic, olive oil; `italian`, `pork`, `pasta`, `simmer`). Olive oil is an always-have. Reference date 13 Oct.

| | Fennel, orange and chicken traybake | Penne arrabbiata (favourite) |
|---|---|---|
| Shared | fennel (df 2, d 0.73), garlic (df 40, d 0.10) | pasta (df 15, d 0.33), parmesan (df 8, d 0.46), garlic (0.10) |
| Overlap | 0.83 / 1.5 = 0.55 | 0.89 / 1.5 = 0.59 |
| Favourite | 0 | +0.60 |
| Effort | easy +0.30 | easy +0.30 |
| Recently cooked | last 18 Aug, 0 | 3 Oct: 1 - 10/28 = 0.64, so -0.32 |
| Variety | british, chicken, potato, roast: 0 | italian (0.125), pasta (0.15), simmer (0.075): -0.35 |
| **Score** | **0.85** | **0.82** |
| Card reasons | "Uses the rest of the fennel from Fennel and sausage pasta", "Easy" | "A favourite", "Shares parmesan and pasta with Fennel and sausage pasta" |

The traybake wins narrowly. Had the arrabbiata not been cooked ten days ago it would have won, which is the behaviour we want: a favourite that shares a lot comes back, but not every week, and not next to another Italian pasta without a fight.

These scenarios (and the rest of section 7) become the planner's fixture tests; the weights are tuned against them, not against intuition at implementation time.

## 9. Seams for later

- **Presets**: `{ name, weights: Partial<Weights>, query?: QueryTree }`. "Easy week" = effort weight up plus `-effort:hard`. "Cheap week" needs a cost signal that does not exist yet (no prices in the knowledge base).
- **Learned cadence**: replace the constant gap with `gap(recipe)` from plan history; the term and its reason stay.
- **Rules**: the hard layer already has its slot (section 2, point 4).
- **Dismiss with a reason**: "never" becomes a persisted personal-layer fact that the hard layer excludes; "not this week" is today's skip.
- **Pack-aware overlap**: weight a shared ingredient by how much of a bought pack the second recipe uses up, from quantities and pack sizes, instead of by distinctiveness alone.
- **Dated suggestions**: weekday vs weekend effort, and spacing similar dishes apart in time.
