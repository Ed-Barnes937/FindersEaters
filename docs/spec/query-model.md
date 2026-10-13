# Query model (V0.1)

Resolves [Define the query model](https://github.com/Ed-Barnes937/FindersEaters/issues/11). Feeds the V0.1 spec (`docs/spec/v0.1.md`), [Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13), [Decide how the food knowledge base is seeded](https://github.com/Ed-Barnes937/FindersEaters/issues/9) and [Design suggestion scoring and selection](https://github.com/Ed-Barnes937/FindersEaters/issues/12). Builds on `docs/spec/tag-taxonomy.md`.

Every decision here is agent-decided and reversible: V0.1 persists no queries (collections are out and hard rules are foundation-only), so the grammar, the tree and the compiler can all change without a data migration. Nothing was escalated.

## Summary

- A **query** filters recipes. It never ranks or sorts: sort order is a separate parameter of the search screen, and scoring belongs to the planner.
- A query is a boolean tree (and, or, not) of **predicates**. Each predicate tests one **field** of a recipe: a dimension, a user tag, an ingredient, total time, the title, or a personal-layer fact.
- The text form is `cuisine:italian,thai -ing:dairy time:<30 lasagne`. Space means and, `OR` means or, `-` means not, a comma inside a value list means "any of".
- A predicate matches only on what is known. Unknown never matches a positive predicate, so negation includes it: `-cuisine:italian` returns recipes with unknown cuisine. Unknown is asked for directly with `dimension:unknown`.
- The server is authoritative. It parses the text, compiles the tree to one parameterised Postgres query scoped to the household, and returns the results plus the parsed tree (or errors with positions).
- The plain filter UI edits a flat subset of the tree (an and of possibly negated predicates) and writes canonical text into the URL. Anything typed outside that subset still runs; it just shows as text, not chips.
- A **rule** (foundation-only) is a query plus a minimum and/or maximum count of matching plan items. The planner gets each rule's matching recipe ids from the same SQL compiler, so there is one executor, not two.
- Adding a field is one entry in a field registry (parse, print, compile, UI metadata). That is how the ⚑ search features land later.

## What a query can express (V0.1 field registry)

| Field | Values | Operators | Matches when |
|---|---|---|---|
| `meal`, `cuisine`, `protein`, `carb`, `method`, `effort`, `equipment`, `diet` | Taxonomy slugs for that dimension, comma-separated; or `unknown` | any-of list | The recipe's **effective** tags (engine tags with corrections applied) include any listed value. `dim:unknown` matches when the recipe has no effective value in that dimension. |
| `tag` | User tag names, comma-separated | any-of list | The household has put any listed user tag on the recipe. |
| `ing` | Food knowledge base node slugs, comma-separated | any-of list | Some ingredient line (quantified or unquantified, optional lines included) resolves to that node or any descendant. `ing:dairy` matches a recipe with cheddar. |
| `time` | Minutes: `30`, `30m`, `1h`, `1h30`; or `unknown` | `<` `<=` `>` `>=`; a bare value means `<=` | Total time compares true. Unknown time never compares true. |
| `is` | `favourite` | - | The household has marked the recipe a favourite. |
| `cooked` | A duration ago (`14d`, `2w`) with `<` or `>`; or `never` | `<` `>` | `cooked:<14d`: last cooked within the past 14 days. `cooked:>14d`: last cooked more than 14 days ago (never-cooked recipes do not match; use `-cooked:<14d` to include them). |
| `title` (and bare words) | Free text | - | Every word appears, case-insensitively, as a substring of the recipe title. |

Notes on the boundaries:

- **`unknown` is a reserved keyword**, never a slug. It is distinct from the `cuisine` value `none` ("this dish has no cuisine"): `cuisine:none` matches a confident "no cuisine", `cuisine:unknown` matches "not confident".
- **Multi-valued dimensions**: `protein:chicken,beef` means has chicken or beef. "Has both" is two predicates: `protein:chicken protein:beef`. For a multi-valued dimension, `unknown` means no value at all, whatever the reason.
- **Effort is matched as a list**, not an ordinal range: "easy or medium" is `effort:easy,medium`. Ordinal operators can be added to the registry later if a UI needs them.
- **Excluding an ingredient vs a dietary tag**: `-ing:dairy` excludes recipes with any line that resolves under dairy, so a recipe with an unresolved line still shows. `diet:dairy_free` is the conservative claim (unknown blocks it). The filter UI offers both, labelled differently ("without dairy" vs "dairy free"), and the dietary one carries the "a guide, not allergen safety" note from the taxonomy.
- **Ingredient values are knowledge base node slugs** (`fennel`, `dairy`, `sweet-potatoes`), not free text. The UI resolves what the user types (including synonyms) to a slug through autocomplete. An unknown slug is a parse error, never a silent empty result.
- **Personal-layer fields** in V0.1 are `is:favourite` and `cooked`. Rating and times cooked exist only as structure in V0.1, so their fields (`rating:>=4`, `cooks:>=3`) are not registered until a UI sets them. Where "last cooked" comes from is a data-model question (see hand-offs).
- **Provenance** (`from:bbcgoodfood.com`, `book:"..."`) is not registered in V0.1. It is a one-entry addition when the library screen wants it.

## Abstract structure

The tree lives in a shared package used by client and server, validated with Zod at the tRPC boundary.

```ts
type Query = { v: 1; root: Node | null }        // null root = every recipe

type Node =
  | { kind: 'and'; children: Node[] }           // 2+ children
  | { kind: 'or'; children: Node[] }            // 2+ children
  | { kind: 'not'; child: Node }
  | { kind: 'in'; field: SetField; values: string[] }        // any-of; dimensions, tag, ing, is
  | { kind: 'unknown'; field: DimensionField | 'time' }
  | { kind: 'cmp'; field: 'time'; op: '<' | '<=' | '>' | '>='; minutes: number }
  | { kind: 'cooked'; op: '<' | '>'; days: number }
  | { kind: 'never-cooked' }
  | { kind: 'text'; field: 'title'; text: string }
```

- **Normalisation**: values are lowercased; dimension values accept display labels and spaces or hyphens and map to slugs (`cuisine:"Middle Eastern"` becomes `middle_eastern`); value lists are de-duplicated and sorted; nested ands and ors are flattened; double negation is removed. Two queries that mean the same thing print the same.
- **Version**: `v` is the tree's format version. When collections or rules start persisting trees, they store this JSON (not text), and a taxonomy value rename migrates stored trees alongside stored slugs and corrections.
- **Limits**: at most 500 characters of text and 32 predicates per query, to bound the generated SQL.

## Text syntax

```
query     = [ or_expr ]
or_expr   = and_expr { "OR" and_expr }
and_expr  = unary { unary }                    (whitespace between terms)
unary     = [ "-" ] primary
primary   = "(" or_expr ")" | predicate | word
predicate = field ":" [ op ] value { "," value }
op        = "<" | "<=" | ">" | ">="
value     = bare | '"' quoted '"'
word      = bare | '"' quoted '"'              (a title word or phrase)
```

- Precedence is not, then and, then or. `OR` is uppercase only, so the word "or" in a title search is just a word.
- Field names are case-insensitive. An unregistered field (`foo:bar`) is an error, not a title search, so typos surface.
- Operators are only valid on `time` and `cooked`, with a single value.
- **Errors** carry a character span and a message ("unknown cuisine 'itallian', did you mean 'italian'?"). The server returns them; the UI underlines them and shows no results rather than guessing.
- **Round trip**: `parse(print(tree))` equals `tree` for every normalised tree. This is a property test in the shared package.

Examples:

| Text | Meaning |
|---|---|
| `cuisine:italian,thai time:<30` | Italian or Thai, under 30 minutes |
| `-ing:dairy diet:vegetarian` | No dairy ingredient, and derived vegetarian |
| `is:favourite -cooked:<3w` | Favourites not cooked in the last three weeks (including never) |
| `(carb:pasta OR carb:noodles) -protein:pork` | Pasta or noodle dishes without pork |
| `cuisine:unknown` | Recipes whose cuisine the engine was not confident about (useful in review) |
| `tag:"from gran" pie` | Gran's recipes with "pie" in the title |

## Semantics: two-valued, known facts only

- Every predicate is true or false for every recipe. A predicate is true only when the stored, effective fact satisfies it; a missing fact (unknown tag, unknown time, never cooked, unresolved ingredient) makes it false.
- `not` is the plain complement of that. This is why `-cuisine:italian` includes unknown cuisine, and why the planner's "unknown never counts as a match" falls out for free.
- This must hold in SQL, where comparisons with NULL are NULL: the compiler wraps every compiled predicate as `COALESCE(<expr>, false)` before negation, so `-time:<30` returns recipes with unknown time.

## Rules (foundation-only)

```ts
type Rule = { query: Query; min?: number; max?: number; per: 'plan' }
```

- A rule counts the plan items in a plan (anchors and suggestions together) whose recipe matches the query, and requires the count to be within `min` and `max`. "At most 1 pasta" is `{ query: carb:pasta, max: 1 }`; "never fish" is `{ query: protein:fish, max: 0 }`.
- `per` is only `plan` for now. A `day` scope can be added when presets need it; plan items already carry optional dates.
- Execution: the planner asks the query executor for the set of recipe ids that match each rule's query (one SQL query per rule, over the household's library), then counts membership in memory while it selects. There is no second, in-memory matcher that could drift from the SQL one.
- A `max: 0` rule is a hard filter on the candidate pool. Other limits are checked as each pick is added, matching the "hard filter, then soft rank" shape from the feature cut.

V0.1 uses the same path without rules: the suggestion request's "which meal types" parameter compiles to a query (`meal:dinner`), and the candidate pool is that query's result. So the planner exercises the query model from day one.

## Collections (out of V0.1, shape only)

A collection is `{ name, query: Query }` owned by the household. Sort order, if a collection wants one, sits beside the query, not in it.

## How the plain filter UI compiles to it

- The search screen has one text box and a filter sheet. Both edit the same tree; the URL holds the canonical text as `?q=`, so back, refresh and sharing a link all work.
- The filter sheet edits the **flat form**: an and of predicates, each optionally negated.
  - Each dimension is a row of chips. Selecting chips in one dimension builds one any-of predicate; rows are anded. A chip cycles off, include, exclude; excluded chips form a separate negated predicate for that dimension.
  - Ingredients: autocomplete over knowledge base names and synonyms, each pick an include or exclude `ing` value.
  - Time: presets (15, 30, 45, 60 minutes, any) set one `time:<=N` predicate.
  - Favourites: a toggle for `is:favourite`. "Not cooked recently": presets for `-cooked:<2w`, `-cooked:<4w`.
  - User tags: autocomplete over the household's user tags.
- Text typed in the box is parsed and shown as chips under it. If the tree is not in flat form (it contains `OR` or parentheses), the sheet shows it as read-only text with a "clear" action instead of chips. Nothing typed is lost or rewritten.
- Which dimensions and values the sheet shows, its layout and the default sort belong to the search and library screen details, not the query model.

## Execution against Postgres

- The server parses `q`, resolves ingredient slugs and tag names against the knowledge base and the household, and compiles the tree into one `SELECT` over the household's recipes with Drizzle's parameterised `sql` template. Values are always bound parameters, never interpolated.
- Every query is scoped by household in the outer `WHERE`, whatever the tree says.
- Each node compiles to a boolean SQL expression over the **query surface**, the logical relations below. Dimension, tag and ingredient predicates compile to `EXISTS` subqueries; and, or and not compile to SQL `AND`, `OR` and `NOT COALESCE(..., false)`.

| Relation (logical) | Holds | Used by |
|---|---|---|
| recipe | id, household, title, total minutes (nullable) | `time`, `title`, scope |
| recipe effective tag | (recipe, dimension, value) after corrections, including stored implied diet tags | dimension fields |
| recipe ingredient node | (recipe, knowledge base node) for every quantified or unquantified line that resolved | `ing` |
| knowledge base ancestor | (node, ancestor) closure including self | `ing` |
| personal layer | (household, recipe): favourite, last cooked date, user tags | `is`, `cooked`, `tag` |

- `dim:unknown` compiles to "no effective tag row for that dimension". `ing:dairy` compiles to an `EXISTS` over recipe ingredient node joined to the ancestor closure where the ancestor is `dairy`.
- Whether each relation is a table, a view or a maintained projection is for [Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13). Recommended: effective tags are a maintained table, written in the same transaction as engine output and corrections; the ancestor closure is a table rebuilt whenever the knowledge base is seeded. All of it is derived and can be rebuilt.
- Scale: libraries are 50-150 recipes now, perhaps low thousands with link packs. Correlated `EXISTS` on indexed `(recipe, dimension, value)` and `(ancestor, node)` keys is well inside budget at that size. No search engine, no full-text index, no `pg_trgm` in V0.1; title matching is `ILIKE` on the household's rows.
- Results return recipe summaries in the sort order the search screen asks for. No facet counts in V0.1.

Worked example: `cuisine:italian,thai -ing:dairy time:<30`

```sql
SELECT r.id FROM recipe r
WHERE r.household_id = $1
  AND COALESCE(EXISTS (SELECT 1 FROM recipe_tag t
        WHERE t.recipe_id = r.id AND t.dimension = 'cuisine' AND t.value = ANY($2)), false)
  AND NOT COALESCE(EXISTS (SELECT 1 FROM recipe_ingredient_node i
        JOIN kb_ancestor a ON a.node_id = i.node_id
        WHERE i.recipe_id = r.id AND a.ancestor_id = ANY($3)), false)
  AND COALESCE(r.total_minutes < $4, false)
```

(Table names are illustrative; the data model names them.)

## Module shape

One deep module, `query`, in a shared package:

- `parse(text) -> { tree, errors }` and `print(tree) -> text`, pure, used on both sides.
- `toFlatForm(tree) -> FlatForm | null` and `fromFlatForm(flat) -> tree`, for the filter sheet.
- Server only: `compile(tree, household) -> SQL` and `execute(tree, household, sort) -> recipe ids`.
- A field registry is the only place a field is defined: its value type, normalisation, printing, SQL compilation and filter-sheet metadata.

Tests: parser and printer round-trip properties; a table of text to expected tree; and SQL conformance tests that run each example against a seeded Postgres with recipes chosen to hit unknown, negation, hierarchy and NULL cases.

## Extensibility for the ⚑ features

| Later feature | How it lands |
|---|---|
| Natural language to chips | A model turns a sentence into a tree; the chips are its flat form. The tree is the contract, so the model never writes SQL. |
| Saved collections | `{ name, query }` stored as tree JSON with `v`. |
| Hard rules and presets | `Rule` above; a preset is a named set of rules and soft-signal weights. |
| Semantic search ("cosy") | A new field whose compile step uses pgvector (already available on Neon) to filter by similarity above a threshold. Ranking by similarity is a sort, outside the query. |
| Relational search ("like this but vegetarian") | A `like:<recipe>` field, anded with ordinary predicates. |
| "What can I make with" | An `ing` coverage field (`have:` list with a minimum share) or a sort; either is a registry entry. |
| Members' likes, ratings, times cooked | New personal-layer fields (`liked-by:`, `rating:`, `cooks:`). |
| Season, provenance | A new dimension is automatic from the taxonomy; provenance is `from:` and `book:`. |

## What this asks of other tickets

- **[Design the V0.1 data model](https://github.com/Ed-Barnes937/FindersEaters/issues/13)**: provide the query surface above: effective tags per recipe (corrections applied, implied diet tags stored), resolved ingredient nodes per recipe (quantified and unquantified lines), a knowledge base ancestor closure, total minutes as a nullable number, and personal-layer favourite, last cooked date and user tags. Decide what "last cooked" is derived from (a past-dated plan item, or an explicit "cooked it" mark).
- **[Decide how the food knowledge base is seeded](https://github.com/Ed-Barnes937/FindersEaters/issues/9)**: every node needs a stable, unique, human-readable slug (the Open Food Facts id without its `en:` prefix is the obvious candidate) and searchable names and synonyms for autocomplete; the hierarchy must support an ancestor closure.
- **[Design suggestion scoring and selection](https://github.com/Ed-Barnes937/FindersEaters/issues/12)**: the candidate pool is the result of the request's query (meal types); rules, when they arrive, are membership sets from the same executor; unknown never matches.
- **Search and library details** (map fog): filter sheet layout, which values to surface, default sort, empty and error states.
