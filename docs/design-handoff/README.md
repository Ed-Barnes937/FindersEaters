# Design handoff

Everything needed to take Finders Eaters V0.1 to Claude Design for polished screen designs, before any UI is built.

| File | What it is |
|---|---|
| [`BRIEF.md`](BRIEF.md) | The design brief, written for someone with no project context. Supersedes `docs/spec/design-brief.md`. |
| [`screenshots/`](screenshots/) | 93 PNGs at 390 x 844 (2x): every state of the three prototypes (chosen variant marked `a-chosen`, losing variants `rejected`) and greyscale wireframes of every screen without a prototype. |
| [`screenshots/INDEX.md`](screenshots/INDEX.md) | One line per image: screen, state, what it shows, spec section, and a question for the designer. |
| [`wireframes/`](wireframes/) | The throwaway HTML behind the `wf` screenshots. Rough on purpose. |

## Handing it to Claude Design

1. Start a new Claude Design project.
2. Upload:
   - `BRIEF.md` (required).
   - The screenshots. If there is an upload limit, prioritise the chosen-variant prototype images (`*-proto-*-a-chosen-*`) and the wireframes (`*-wf-*`); the `rejected` ones are context only.
   - `screenshots/INDEX.md`.
   - Optionally the three prototype HTML files from `docs/prototypes/` (each runs standalone in a browser and shows the interactions).
3. Paste this as the opening prompt:

> I'm designing Finders Eaters, a mobile-first installable web app for a UK household: a recipe library that understands its recipes, suggests what to cook with reasons, and makes a shopping list that works offline in the shop. The attached BRIEF.md is the full brief; the screenshots show unpolished prototypes (behaviour decided, look not) and rough greyscale wireframes (structure only), indexed in INDEX.md.
>
> Please start with a small design system: semantic colour tokens for light and dark (AA contrast), a type scale, spacing, radius and elevation, as design tokens. Show it on the three hardest components first: the shopping row (with ticked, settling and "was N" states), the suggestion card with its reasons, and the review check card next to a glance line and a clear line. Then design every screen and state in section 6 of the brief at 390 x 844, keeping each screenshot's NN number in your file names. Keep the tone calm and plain, text-only rows (no images), primary actions in thumb reach, and nothing that relies on colour alone. Tell me where you think the brief is wrong, and answer the open items in section 9.

4. Review in rounds: design system and three components first, then Recipes and Shopping, then the rest.

## Bringing the results back

Land the outputs on `main` (docs only) under `docs/design/`:

| Output | Where |
|---|---|
| Design tokens | `docs/design/tokens.json` (W3C design tokens format, or `tokens.css` with custom properties if that is what comes back) |
| Final screens | `docs/design/screens/NN-screen-state.png`, numbered to match `screenshots/` here |
| Component sheet | `docs/design/components/` |
| Designer notes and decisions | `docs/design/README.md`, with any brief corrections also applied to `BRIEF.md` and the specs |

When the tokens land, the build turns them into the app's SCSS variables in its own package (a code change on `develop`, not here), and UI tickets on the V0.1 build tracker (#29) can start. Visual identity choices that are hard to reverse (name, wordmark) go to the owner first.

The `wireframes/` and `screenshots/` here are scaffolding: once `docs/design/` holds the final screens, this folder can be deleted.
