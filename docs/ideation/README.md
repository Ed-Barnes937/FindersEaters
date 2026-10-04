# Finders Eaters (working name)

*A recipe book that understands its recipes.*

You bring in the recipes you already cook, from websites, cookbooks or your own
notes, and the app reads each one into a consistent, structured form. Quantities
read the same way everywhere, scale cleanly for batch cooking, and every recipe
is tagged against a shared understanding of food. That foundation makes the
collection genuinely searchable, and it lets the app help with the part that
actually wears people down: deciding what to cook this week. It suggests
balanced plans built around the meals you've already chosen, explains why it
suggests each one, and turns the plan into a shopping list that already knows
you have oil.

Status: concept, 2026-09-25. Problem space explored and V1 scope set; no UX
or system design yet.

## Contents

| File | What it is |
|---|---|
| [features.md](features.md) | Feature list scored for V1 importance and complexity |
| [architecture.excalidraw](architecture.excalidraw) | Module boundaries and where each module runs (client, server, external) |
| [research/](research/) | Spike findings: [open food data and stock recipes](research/open-food-data.md), [iOS import and platform](research/ios-import-and-platform.md), [Jev capabilities](research/jev-capabilities.md) (hands-on test pending in [jev-spike/](research/jev-spike/)) |

## The problems

1. **Recipes don't agree with each other.** One says 130g onion, another says
   half an onion, a third says a cup of diced onion. Translating between them,
   and scaling them for a batch cook, is manual work every time.
2. **Weekly meal planning is high-friction.** Choosing a varied, sensible week
   from the recipes you know is a recurring chore, and turning it into a
   shopping list is another.

Built to solve these for one household first (one hot meal a day), and designed
so that nothing about that household is baked in as a restriction.

## Principles

1. **Never destroy what the user gave us.** The original recipe text is always
   kept next to the parsed version. A bad parse is fixable, and an improved
   engine can re-parse old recipes.
2. **The app doesn't need to know your kitchen.** No pantry tracking. An item
   marked "always have" (oil, salt) starts ticked on every shopping list, and
   that's the full extent of it. This is the main scope guard.
3. **Suggestions explain themselves.** Every suggestion carries a reason
   ("uses the rest of the coriander", "not had in 7 weeks"). This builds trust
   and makes a misbehaving system obvious.
4. **Modular by construction.** New planning rules and search features should
   slot into existing structures (see the query language below) rather than
   needing re-architecture.
5. **Mobile first.** Phone, then tablet, then desktop, for every interaction.

## Key concepts and why they exist

**Canonical measure per ingredient.** The engine doesn't convert everything to
grams. Each ingredient has its natural measure (onions are counted, milk is ml,
flour is grams) plus rough conversions between forms (1 medium onion is about
150g). So "130g onion" and "1/2 onion" are stored consistently and displayed in
whichever form reads best. This is what makes cross-recipe consistency, scaling
and shopping list merging possible. Scaling isn't perfectly linear (eggs round,
spices scale less, tins and oven times change), so the engine flags ingredients
it can't scale cleanly.

**Three kinds of ingredient line.** The test is "would you buy it or get it
out?". A line is either *quantified* ("200g rice": scales, goes on the list),
*unquantified* ("salt, to taste": stays in the list without a quantity, likely
an "always have") or *not an ingredient* ("a splash of water": moves into the
method). Deciding which is a per-line classification problem.

**Jev does the classification work.** Jev (typesafe.ai) is a very fast, very
cheap classifier. Much of the engine can be framed as per-line classifications
(which bucket, which canonical ingredient, which unit, which prep, which tags),
leaving an LLM only for messy leftovers such as badly scanned cookbook pages.

**Engine grading rules.** These came out of the Jev spike. Resolve each
ingredient to the most specific knowledge-base entry the text supports ("a knob
of butter" is *butter*, not salted or unsalted). Every tag needs a written
definition, for Jev and for the golden test set alike. Judge each field by what
depends on it: quantity, unit, size and ingredient feed scaling and shopping,
so they must be exact, while prep and notes are display only. Words like
"heaped" and "level" modify the unit; quantities are always numbers, handled
by code.

**Four layers of data.** Facts about *food* (an ingredient hierarchy: cheddar,
hard cheese, cheese, dairy). Facts about the *recipe* (parsed ingredients,
tags, structure, provenance). Facts about the *household* (favourite, rating, notes, how
you think of it). Facts about *history* (saved plans, which give recency,
cadence and implicit favourites). Keeping "household" separate from "recipe" lets
stock recipes carry your personal data without being copied.

**Tags are the contract between the two halves.** Search, similarity and
planner rules all read the same tags, so the taxonomy is a design decision, not
a list. Tags are organised in fixed dimensions (cuisine, meal type, main
protein, carb base, method, time, effort, dietary, equipment, season), with
free-form user tags on top. Dietary tags are derived from the ingredient
hierarchy rather than guessed.

**One query language underneath search, collections and rules.** A search is a
query (`tag:pasta time:<30 -dairy`). A saved collection is a named query. A
planner rule is a query plus a limit ("at most 1 match for `tag:pasta` per
plan"). This is how the modularity principle is met. Nobody types this on a
phone: natural language goes in, and editable chips come out.

**Suggestions in two layers.** Hard rules filter candidates, then soft signals
rank what's left. The signals include favourites, effort, ingredient overlap
weighted by distinctiveness (shared salt is worth nothing, shared fennel is
worth a lot), and cadence. The week is treated as a set, so each pick is
penalised for being too similar to what's already chosen, which is what stops
three pasta bakes. Users pick presets ("Easy week", "Cheap week") rather than
tuning weights.

**Cadence, not recency.** A loved but expensive meal shouldn't come round
often, so "time since last cooked" isn't a good signal on its own. Each recipe
has a natural rhythm (weekly staple, monthly curry, twice-yearly wellington),
and a recipe becomes "due" as it approaches its usual gap.

**Plans are lists.** A plan is a list of recipes keyed by date. Assigning days
is optional. Meal type (breakfast, lunch, dinner, side, dessert) is a tag, not
plan structure, and a household setting ("we plan 1 hot meal a day") sets the
defaults.

**Cold start is solved by import, not hosted recipes.** Suggestions with 10
recipes are just "the other 9", so a new user needs a library fast. Rather than
host a stock library (no good open set exists, and writing our own isn't
practical), we offer **link packs**: themed lists of links such as "UK weeknight
classics". One tap imports a pack into the user's own library, fetched and
parsed per user, with attribution and a link back to the source. We never host
or redistribute recipe content. An agent curates the packs: it finds good UK
recipes, checks each page parses cleanly and each site's terms allow it. A
periodic health check catches broken links, and packs mix sites so one failure
doesn't empty a pack.

## Stages

Features scoring 4-5 in [features.md](features.md) make up V1. They arrive in
two steps.

**V0.1** proves the core loop for one household: URL import and manual entry,
the engine, tagging, library, search, plans, suggestions and shopping lists.
It is single-user, but built on the assumption that everything below will be
added before V1, so none of it should need re-architecture.

**Before V1:**
- **Household sharing.** Left out of V0.1, but the data model treats a
  household as the owner from day one.
- **Cookbook scanning.** An epic in its own right. Deferred until the rest of
  the app has proved itself.
- **Link packs for onboarding.** A new user has zero recipes and wants to try
  the app before importing anything, so V1 needs agent-curated link packs (see
  "Cold start" above). Not needed for V0.1, where the household imports its own
  recipes.

**Platform path:** a React web app, installable as a PWA, for V0.1. Android
gets the share sheet via the PWA share target. iPhone gets an Apple Shortcut in
the share sheet (posting to the API with its own token) and a "Paste link"
button, because iOS PWAs can't join the share sheet. It gets wrapped in
Capacitor for app store releases later. Testing an iOS share extension needs
the paid Apple licence, so that decision arrives with the Capacitor stage.

**Import captures on the device.** Several UK recipe sites block server-side
fetching, so the device sends the page content (or its structured recipe data)
to the server. Server-side fetching is the fallback, and also how link packs
are imported, so packs only include sites that allow it.

**Knowledge base seed data.** Open Food Facts ingredients taxonomy for names,
UK/US synonyms, hierarchy and dietary properties (ODbL, share-alike, so it
lives in its own open data layer). Intake24 (UK) for portion weights, with
USDA SR Legacy filling gaps and giving densities. Details in
[research/open-food-data.md](research/open-food-data.md).

**Spikes:**
- **Jev hands-on test.** Done. Every answer at confidence 0.8 or above was
  correct, and no tested stage needed an LLM. The improved extraction framing
  still needs confirming on fresh lines (the household's own recipes). See
  [research/jev-capabilities.md](research/jev-capabilities.md).
- **Recipe site terms (before V1).** Do BBC Good Food, BBC Food, Jamie Oliver
  and other link-pack candidates allow automated fetching for personal import?
- **Cookbook barcode import.** How do other apps do it? Full recipes or only an
  index? Probably index-only, or not possible, because of copyright.

## Open questions

- Is a plan item always one recipe, or can it be a meal of several (curry, rice
  and a side)? Affects shopping lists and suggestions.
- Where exactly is the taxonomy's fixed/free-form boundary?
