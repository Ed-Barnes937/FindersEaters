# The own layer

Reviewed YAML kept in the product repo, curated through pull requests (`docs/spec/food-knowledge-base.md` sections 3, 5, 6 and 9). Ingredients are referenced by slug: an OFF id without `en:`, or an own slug (or an old one kept in `slug_aliases`). One file per concern:

| File                    | Holds                                                           |
| ----------------------- | --------------------------------------------------------------- |
| `ingredients.yaml`      | own ingredients (`key`, `slug`, `name`, "is a" `parents`)       |
| `names.yaml`            | names ahead of OFF's, en-gb first, and display names            |
| `edges.yaml`            | `add`, `remove` or `reclassify` an edge ("is a" or "made from") |
| `dietary.yaml`          | the seven tri-state properties, set on high branches            |
| `measures.yaml`         | canonical measure, item weights and density with `quality`      |
| `packs.yaml`            | typical packs (`tube` 200 g)                                    |
| `aisles.yaml`           | aisles on high "is a" branches                                  |
| `links.yaml`            | an ingredient's Intake24 food code and USDA FDC id              |
| `protein-branches.yaml` | the hierarchy nodes each `protein` tag gates on                 |
| `retired.yaml`          | an ingredient that is gone, with `replaced_by`                  |
| `expectations.yaml`     | names that must resolve to a given ingredient (UK clashes)      |

`pnpm --filter @finders-eaters/kb kb build` downloads the pinned sources, applies this layer and validates. Content beyond this seed is the own-layer seed ticket (#39).
