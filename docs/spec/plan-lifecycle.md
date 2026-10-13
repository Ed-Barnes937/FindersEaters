# Plan lifecycle and shopping list scope

Resolves [Define the plan lifecycle and what a shopping list covers](https://github.com/Ed-Barnes937/FindersEaters/issues/26). Builds on [Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13) (`docs/spec/data-model.md` section 6), [Prototype building a plan with suggestions](https://github.com/Ed-Barnes937/FindersEaters/issues/15) (`docs/spec/planner-screen.md` section 6) and [Define shopping list merge and regeneration rules](https://github.com/Ed-Barnes937/FindersEaters/issues/23) (`docs/spec/shopping-list.md`).

Every decision here was made by the agent under the owner's standing rules and is reversible: plans, plan items and tick records are already the stored state, and nothing here adds a stored shape that is expensive to change.

## 1. Shape in one paragraph

A plan is a discrete set of plan items, and **its shopping list covers every plan item in it, whatever the item's date**: past, today, future or undated. Ticks belong to the plan's list, so **ticks reset only when a new plan starts**. The household starts a new plan by hand (New plan); the app never starts one on its own, but it nudges once a plan is **finished**. Starting a new plan moves the old plan's **not-yet-cooked** items over (undated, or dated today or later) and carries their ticks, which show as **At home** on the new list. The list is computed on read (`docs/spec/shopping-list.md`); the only stored list state is the tick record, which replaces the materialised tables in `docs/spec/data-model.md` section 7.

## 2. Past-dated items stay on the list

Decision: the shopping list is built from **all** of the plan's items. A plan item dated before today still contributes.

Why, stress-tested with three scenarios:

1. **Weekly shop, midweek top-up.** Plan Sat-Fri, five dated items, everything ticked on Saturday. On Wednesday the household opens Shop to top up. Monday's chilli is past. Kept on the list, its items are already ticked (In the basket), so the aisles show only what is still unbought. Dropping it would change nothing the shopper cares about.
2. **The household never presses New plan** and keeps adding to one plan for three weeks. Week 1's chilli needed 2 onions and the shopper ticked them (snapshot 2). Week 3 adds a dal needing 2 onions.
   - Kept: the need is now 4, which exceeds the snapshot, so onions untick with "was 2". Correct: two more onions are needed.
   - Dropped: the chilli's dates are past, so the need is 2, which is within the snapshot, and onions stay ticked. **Wrong**: the week-1 onions were eaten.
   The tick snapshot compares cumulative need with cumulative purchase. That only holds if the list's scope is cumulative too, so dropping past items would make stale ticks look satisfied. This is the deciding reason.
3. **Plans slip.** Chilli planned for Monday, cooked Thursday, never re-dated. Dropping past items would remove its ingredients from the list on Tuesday, before they are bought. Keeping them is right whatever the household does with dates.

Cost: a plan used for weeks grows a long In the basket section. Section 4's finished-plan nudge handles that, and In the basket is collapsed by default (prototype).

## 3. When ticks reset

- One shopping list per plan; ticks are per (plan, item key). A **new plan starts a fresh list**: its items are unticked except always-haves (At home) and carried ticks (section 5).
- Nothing else resets ticks: no date boundary, no time-out, no "clear ticks" control in V0.1. A household that wants a clean list starts a new plan. (A "clear ticks" menu item is an additive later change if real use asks for it.)

## 4. Finished plans and the nudge

- A plan is **finished** when it has a range and today is after `ends_on`; or it has no range, has at least one dated item, and none of its items is dated today or later.
- A plan with no range and only undated items never finishes. It is a running list, and the household decides when to start afresh.
- When the current plan is finished, the Plan and Shop screens show one banner: "This plan ended on Sun 19 Oct. Start a new plan" (no-range form: "Everything in this plan is in the past. Start a new plan"). The button opens the New plan sheet. The banner is dismissible per plan on the device (local storage convenience).
- **No automatic new plan.** Auto-creating would move items and reset ticks without the household's consent, and a midweek top-up after the range ended would find an empty list.

## 5. Starting a new plan

Refines `docs/spec/planner-screen.md` section 6.

- The New plan sheet keeps its date chips. Its carry-over option becomes **"Bring over N recipes not cooked yet"**, ticked by default, shown when N > 0. "Not cooked yet" means undated, or dated today or later. (The prototype only moved undated items; a plan that is replaced before its range ends would otherwise strand its future-dated items in history.)
- Bringing over **moves** the items, keeping their dates, servings and order. They leave the old plan, so a recipe is never planned twice by accident. Items dated before today stay in the old plan as its history (they are cookings).
- **Carried ticks.** In the same transaction, for each item key the moved items contribute to: if the old list's effective state for that key is ticked by a tap (not by always-have default, not exceeded), the new list gets a tick record with `origin: carried`, the old record's `ticked_at`, and a snapshot equal to the moved items' contribution to that key (computed by the shopping function at move time). Scenario: plan A had an undated dal, lentils were bought and the dal was never cooked; the new plan brings the dal over and lentils show as At home, not as something to buy again. If the new plan adds another lentil recipe, the need exceeds the carried snapshot and lentils untick with "was 250 g".
- An explicit untick record (an always-have "out of it this shop") is never carried: a new shop asks again.
- **Sections**: a carried tick shows in **At home** with the source note "Bought for last plan", not In the basket, because it is in the cupboard, not the trolley. Unticking it moves it to its aisle like an always-have. A new tap on the item writes an ordinary tick record (origin `tap`) that replaces the carried one.

## 6. Current plan, past plans and deletion

- The current plan stays derived: the household's most recently created plan (`created_at`, ties broken by id). No column.
- **Past plans** open from the Plan header menu in the same Plan screen with a banner "Past plan · Go to current plan". They stay editable (re-dating or removing items corrects cooking history, which section 6.3 of the data model relies on), but they show no suggest bar.
- A past plan's shopping list is viewable read-only from the past plan: computed from its items and the recipes as they are now, with its tick records. Ticking a past list is not offered.
- **Deleting the current plan** makes the previous plan current again (by the derived rule), with its own ticks. Deleting removes the plan's items and tick records together.
- First run (no plan): the Shop tab shows an empty state pointing to Plan.

## 7. Storage: computed list, stored ticks

`docs/spec/shopping-list.md` (the later decision) wins over `docs/spec/data-model.md` section 7. The assembled spec replaces section 7's `shopping_list` and `shopping_list_item` tables, the `inputs_fingerprint` and the regeneration paragraph with one table:

| Table | Columns | Notes |
|---|---|---|
| `shopping_tick` | plan_id, household_id, item_key (text), ticked (bool), ticked_at (timestamptz, device time), ticked_by (user, null for carried), snapshot (JSON: amount groups and some flag, null when unticked), origin (`tap` or `carried`), received_at (timestamptz, server time); PK (plan_id, item_key) | Later `ticked_at` wins per key. Deleted with the plan. `item_key` is an ingredient id or `unresolved:<normalised text>` (no FK: unresolved keys are text, and retired ids are followed by `replaced_by` at read time). |

- There is no `shopping_list` row: a list is identified by its plan. The ER diagram's `plan ||--|| shopping_list` and `shopping_list ||--o{ shopping_list_item` become `plan ||--o{ shopping_tick`.
- `always_have` is unchanged.
- The phone caches the last list it loaded per plan for offline use; offline taps queue as tick writes (prototype and merge rules unchanged).
- A materialised list can still be added later as a cache with no change to the rules.

## 8. Inputs for other tickets

- **V0.1 spec assembly**: apply section 7 to the data model section, and section 5 to the planner's New plan section.
- **[Write the Claude Design brief](https://github.com/Ed-Barnes937/FindersEaters/issues/17)**: the finished-plan banner (both wordings), "Bring over N recipes not cooked yet", carried ticks in At home with "Bought for last plan", the past plan banner and read-only past list, the empty Shop state.
- **Test and evaluation strategy (map fog)**: section 2's scenario 2 and section 5's lentils scenario are good fixture cases for the shopping function.
