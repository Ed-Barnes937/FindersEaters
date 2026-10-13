# Seed-source coverage of the golden set

Date: 2026-10-13. Ticket: [Check seed-source coverage of golden set ingredients](https://github.com/Ed-Barnes937/FindersEaters/issues/8). It feeds [Decide how the food knowledge base is seeded](https://github.com/Ed-Barnes937/FindersEaters/issues/9). Background: `docs/ideation/research/open-food-data.md`.

## Method

- **Ingredients.** Every ingredient in `docs/ideation/research/jev-spike/golden.json` (dev and heldout lines, the split parts of compound and alternative lines, and the R01-R03 ingredient lists) was collapsed to one concept per distinct food. "heavy cream" and "double cream" count once, as do "baking soda / bi-carb" and "bicarbonate of soda", and "Oxo" and "beef stock cube". That gives **126 ingredients**. "strongly-flavoured seeds" (L180) was left out because it names no food.
- **Golden measure.** Each ingredient is tagged by what the golden lines need to reach a canonical measure: *count* (needs an item weight: 38), *volume* (needs a density: 64) or *weight* (already in g or kg: 24).
- **Sources, fetched 2026-10-13.** Open Food Facts `taxonomies/food/ingredients.txt` (main, 4,837 en entries parsed) and `taxonomies/additives.txt`. Intake24 legacy `foods.xml` and `guide.xml` (2,527 foods). USDA FoodData Central SR Legacy CSV 2018-04 (7,793 foods).
- **Matching.** A script looked up each ingredient by OFF synonym and listed Intake24 and USDA candidates with their portion rows. The agent then judged every row by hand. The per-ingredient verdicts are in the appendix. The scripts were throwaway and are not kept, because the judgement table is the result.
- **OFF verdicts.** *exact*: an entry at the right specificity. *parent only*: only a broader entry exists (self-raising flour resolves to wheat flour). *UK clash*: the UK word resolves to a different food. *missing*: no entry. *additives only*: the food exists only in the additives taxonomy.
- **Measure verdicts.** *Y*: a usable item weight (count) or a level spoon or cup weight (volume). *P*: a proxy food, a serving-sized spoon weight, or only some of the needed forms. *N*: nothing usable.

## Headline numbers

| | Result |
|---|---|
| OFF resolves at the right specificity | **96 / 126 (76%)** |
| OFF resolves only to a broader parent | 22 (17%) |
| OFF clashes with the UK meaning | 2 (2%) |
| OFF has no ingredient entry | 6 (5%: 5 missing, 1 in additives only) |
| Conversion needed (count or volume) | 102 of 126 |
| A clean measure from Intake24 | 38 / 102 (37%) |
| A clean measure from USDA SR Legacy | 79 / 102 (77%) |
| A clean measure from either | **83 / 102 (81%)** |
| Only a partial or proxy measure | 13 / 102 (13%) |
| No measure at all | 6 / 102 (6%) |
| Fully seeded (OFF exact, and a clean measure or weight only) | **83 / 126 (66%)** |

By golden measure: count ingredients get a clean item weight for 28 of 38 (Intake24 19, USDA 27). Volume ingredients get a clean density for 55 of 64 (Intake24 19, USDA 52).

So **about a third of the golden ingredients need something from the own layer**: a name, a fix, a measure, or more than one of these.

## Gaps in Open Food Facts, by kind

| Kind | Ingredients | Count |
|---|---|---|
| UK flour types | plain, self-raising, cake and strong bread flour all resolve only to wheat flour. Self-raising flour contains raising agents, so this matters for more than naming. | 4 |
| UK-sense clashes | **tomato purée**: OFF's "tomato purée" is passata. UK purée is OFF's "tomato concentrate". **cornflour**: OFF's "cornflour" is maize flour. UK cornflour is OFF's "corn starch". A plain synonym lookup resolves both wrongly, and nothing signals the error. | 2 |
| Spice form | ground cumin and ground coriander resolve to the seed (no ground vs whole split). Green cardamom pods resolve to cardamom. Golden recipe type 9 tests whole vs ground. | 3 |
| Meat cuts | brisket, ribeye and stewing beef resolve to beef, beef meat or beef steak. Only chuck steak exists. | 3 |
| Prepared products | vegetable and beef stock cubes (no cube entry, only a generic broth), naan, crusty bread, egg noodles, orzo, jarred roasted red peppers, balti paste, tikka paste. | 9 |
| Varieties | floury potatoes, Shaoxing wine (rice wine), ale (beer). | 3 |
| Missing | chilli flakes, oyster sauce, choy sum (only pak choi), saffron (its entry is commented out), salt and vinegar crisps. | 5 |
| Other taxonomy | bicarbonate of soda exists only as additive E500(ii). | 1 |

The OFF synonyms do cover the UK/US pairs the golden set tests: courgette/zucchini, coriander leaf/cilantro, double/heavy cream, sour/soured cream, spring onion/scallion and rocket/arugula all resolve. Brand synonyms ("Oxo", "Mutti") are absent, as expected.

## Gaps in portion weights and densities, by kind

| Kind | Ingredients | Why |
|---|---|---|
| Pack sizes | tinned chopped and plum tomatoes, black beans, strawberry jam | A tin or jar is a pack, not a portion. USDA's "1 can" is a 190g US can, and UK tins are 400g. The golden lines usually state the pack ("400g tin"). |
| Loose herb measures | fresh coriander, fresh basil, mixed fresh herbs | "bunch", "pack" and "handful" are in neither source. USDA has sprigs and leaves only. |
| Whole spice items | green cardamom pods, cinnamon sticks | Neither source weighs a pod or a stick. Bay leaf is covered only by Intake24 (2g a leaf). |
| Salt grain | coarse sea salt, kosher salt | USDA has table salt only. Coarse salt is much lighter by volume, so table-salt density overstates it. |
| Proxies only | chilli flakes (cayenne), Shaoxing wine (sake) | Close enough to use, but marked as proxies. |
| UK pastes, dairy and dried fruit | balti paste, tikka paste, guacamole, raisins, Greek yoghurt | Intake24 has serving-sized spoons only. The USDA entry is absent or has no portion rows. |
| Unknown produce | choy sum | Only pak choi exists, which is a different shape. |

### How the two measure sources differ

- **Intake24 item weights are UK-sized and should win for count ingredients.** A medium onion is 150g in Intake24 and 110g in USDA. Eggs come in UK small, medium, large and extra large sizes. Other UK weights include a medium courgette (100g), a celery stick (30g), a cod fillet (120g), a chicken breast fillet (130g) and naans in three sizes.
- **Intake24 spoon weights are serving estimates, not culinary measures,** so they must not be used as densities. Cornflour is 30g a teaspoon in Intake24 and about 2.7g in USDA (128g a cup). Butter is 35.4g a tablespoon against USDA's 14.2g. Caster sugar is 6g a teaspoon against 4.2g. Intake24 also has no raw potato, raw sweet potato or fresh chilli, and no fresh coriander or stocks at all.
- **USDA SR Legacy is the density source.** It covers 52 of the 64 volume ingredients with level cup, tablespoon and teaspoon weights. Its item sizes are US sizes.

## How deep the hierarchy goes

The 120 ingredients that OFF resolves to some entry have ancestor chains of these lengths, counting the entry itself:

| Chain length | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Ingredients | 12 | 22 | 48 | 29 | 6 | 3 |

The median is 3. The deepest is extra virgin olive oil < virgin olive oil < olive oil < vegetable oil < vegetable oil and fat < oil and fat. **34 of the 120 sit at length 1 or 2.** These are the shallow spots:

- **Roots with no parent:** salt, egg, margarine, baking powder, mushroom, rice, bread, broth, herb and guacamole.
- **Flat families one level under a root:** every herb under herb (basil, bay leaf, marjoram, oregano). Every cheese under cheese < dairy (cheddar, feta, Parmesan), with no hard vs soft level. Butter and milk sit under dairy. Pasta and noodles under dough. Dark chocolate under chocolate. Worcestershire under sauce. Dijon under mustard. Rice wine and beer under alcohol. Beef under animal.
- **Parents that mean "made from" rather than "is a":** chicken broth sits under chicken < poultry and beef broth under beef < animal, while vegetable broth sits under broth. Rocket sits under salad. So OFF's top-level parents cannot double as shopping categories. Chicken stock would land in poultry.

## Dietary and allergen properties

This answers the map's fog item "Allergen-style properties in the seed".

- **Vegan and vegetarian flags are well covered:** 116 of 120 resolved entries have them, mostly inherited. OFF uses yes, no and maybe, and "maybe" lines up with the hierarchy's unknown state. Parmesan, feta and generic cheese are vegetarian "maybe", which is what the golden dietary probes for R13 and R16 expect.
- **They are not always right.** Worcestershire sauce is vegetarian "maybe", although it contains anchovies.
- **Allergens are sparse:** only 23 of 120 resolve to any allergen, even with inheritance. Spaghetti, egg noodles, naan and bread carry no gluten. Worcestershire carries no fish. So the own layer has to own the UK 14 allergens. OFF can only be a hint.
- **Links:** 75 of 120 entries have a Wikidata id (the en-gb label route) and 45 have a CIQUAL code.

## What this means for seeding (agent-decided, reversible)

These are inputs to [Decide how the food knowledge base is seeded](https://github.com/Ed-Barnes937/FindersEaters/issues/9), not that ticket's decision.

1. **The own layer is substantial but bounded.** About a third of golden ingredients need an own-layer entry or fix (30 names, 19 measures, with overlap). If the golden set is representative, a seeded base of about 1,000 cooking ingredients would need roughly 250-350 own-layer rows (I: this is an extrapolation).
2. **UK senses beat OFF synonyms.** Resolution must check own-layer en-gb synonyms before OFF synonyms, because tomato purée and cornflour resolve silently wrong otherwise. Add a golden check for each clash.
3. **Measure precedence.** Use an own-layer value first, then Intake24 for item weights, then USDA SR Legacy for item weights and densities. Never use Intake24 spoon weights as densities. Keep a source on every conversion so proxies stay visible.
4. **Pack size is not a conversion.** Tins and jars resolve through the pack size the line states ("400g tin"). Otherwise they use an own-layer typical pack. Glossary term proposed below.
5. **Spice form and flour type are own-layer children.** Ground vs whole sits under each spice, and the UK flour types sit under wheat flour, inside the OFF hierarchy.
6. **Allergens and aisle categories come from the own layer.** OFF's vegan and vegetarian flags can be seeded as-is, with own-layer overrides.

## Appendix: per-ingredient verdicts

| Ingredient | Golden measure | OFF | OFF entry | Intake24 | USDA SR | Note |
|---|---|---|---|---|---|---|
| basmati rice | weight | exact | basmati rice | - | - |  |
| tinned chopped tomatoes | count | exact | chopped tomato | N | P | can weight is a pack size (US can 190g) |
| red onion | count | exact | red onion | Y | Y |  |
| onion | count | exact | onion | Y | Y |  |
| salt | volume | exact | salt | Y | Y |  |
| black pepper | volume | exact | black pepper | Y | Y |  |
| butter | volume | exact | butter | P | Y | I24 tbsp is a serving (35g) |
| ground cumin | volume | parent only | cumin | Y | P | OFF and USDA have no ground vs whole split |
| chilli flakes | volume | missing | - | N | P | USDA cayenne as proxy |
| garlic | count | exact | garlic | Y | Y |  |
| plain flour | volume | parent only | wheat flour | N | Y | UK flour types missing |
| whole milk | volume | exact | whole milk | N | Y |  |
| chicken stock | volume | exact | chicken broth | N | Y |  |
| double cream | volume | exact | double cream | P | Y |  |
| frozen peas | volume | exact | pea | N | Y |  |
| olive oil | volume | exact | olive oil | N | Y |  |
| fresh coriander | count | exact | coriander leaf | N | P | bunch, pack, handful in neither |
| spaghetti | weight | exact | spaghetti | - | - |  |
| floury potatoes | weight | parent only | potato | - | - | waxy vs floury missing |
| chickpeas | count | exact | chickpea | Y | Y |  |
| lemon | count | exact | lemon | P | Y | I24 only via a citrus guide image |
| salt and vinegar crisps | weight | missing | - | - | - | product, not ingredient |
| margarine | volume | exact | margarine | N | Y |  |
| saffron | volume | missing | - | Y | Y | entry commented out in the taxonomy |
| fresh basil | count | exact | basil | N | P | bunch, handful in neither |
| egg | count | exact | egg | Y | Y |  |
| tomato puree | volume | UK clash | tomato purée | N | Y | OFF tomato purée means passata; UK purée is OFF tomato concentrate |
| unsalted butter | volume | exact | unsalted butter | P | Y |  |
| granulated sugar | volume | exact | granulated sugar | N | Y |  |
| vegetable stock cube | count | parent only | broth | N | Y | no stock cube entries |
| beef brisket | weight | parent only | beef meat | - | - | no beef cuts except chuck steak |
| greek yoghurt | volume | exact | greek yogurt | N | N | USDA entry has no portions |
| red pepper | count | exact | red bell pepper | Y | Y |  |
| vegetable oil | volume | exact | vegetable oil | N | Y |  |
| hot chilli powder | volume | exact | chili powder | Y | Y |  |
| paprika | volume | exact | paprika | Y | Y |  |
| lean beef mince | weight | exact | minced beef | - | - |  |
| beef stock cube | count | parent only | broth | N | Y | no stock cube entries; Oxo brand synonym needed |
| dried marjoram | volume | exact | marjoram | Y | Y |  |
| sugar | volume | exact | sugar | N | Y |  |
| red kidney beans | count | exact | red bean | Y | Y |  |
| long grain rice | weight | exact | long grain rice | - | - |  |
| soured cream | volume | exact | sour cream | N | Y |  |
| caster sugar | volume | exact | caster sugar | P | Y |  |
| self-raising flour | volume | parent only | wheat flour | Y | Y | UK flour types missing |
| baking powder | volume | exact | baking powder | P | Y |  |
| milk | volume | exact | milk | N | Y |  |
| icing sugar | volume | exact | icing sugar | N | Y |  |
| vanilla extract | volume | exact | vanilla extract | P | Y |  |
| strawberry jam | count | exact | strawberry jam | N | N | jar is a pack size |
| cake flour | volume | parent only | wheat flour | N | Y |  |
| strong bread flour | volume | parent only | wheat flour | P | Y | UK flour types missing |
| bicarbonate of soda | volume | additives only | E500(ii) | P | Y | only in the additives taxonomy |
| coarse sea salt | volume | exact | sea salt | N | P | USDA table salt only; coarse salt is lighter |
| light brown soft sugar | volume | exact | light brown sugar | P | Y |  |
| dark chocolate | weight | exact | dark chocolate | - | - |  |
| chicken breast | count | exact | chicken breast | Y | Y |  |
| cornflour | volume | UK clash | corn flour | N | Y | OFF cornflour is maize flour; UK cornflour is OFF corn starch |
| light soy sauce | volume | exact | light soy sauce | Y | Y |  |
| oyster sauce | volume | missing | - | Y | Y |  |
| shaoxing wine | volume | parent only | rice wine | N | P | sake as proxy |
| toasted sesame oil | volume | exact | toasted sesame oil | N | Y |  |
| ground white pepper | volume | exact | white pepper | Y | Y |  |
| choy sum | count | missing | - | N | N | only pak choi exists |
| carrot | count | exact | carrot | Y | Y |  |
| mushrooms | volume | exact | mushroom | Y | Y |  |
| bean sprouts | volume | exact | bean sprouts | P | Y |  |
| ribeye steak | weight | parent only | beef steak | - | - | no beef cuts |
| kosher salt | volume | exact | kosher salt | N | P | USDA table salt only |
| beef stock | volume | exact | beef broth | N | Y |  |
| dijon mustard | volume | exact | dijon mustard | Y | P | USDA yellow mustard as proxy |
| pasta | weight | exact | pasta | - | - |  |
| egg noodles | weight | parent only | noodle | - | - |  |
| chives | volume | exact | chives | P | Y |  |
| potatoes | weight | exact | potato | - | - | I24 has no raw potato |
| leek | count | exact | leek | Y | Y |  |
| vegetable stock | volume | exact | vegetable broth | N | Y |  |
| whipping cream | volume | exact | whipping cream | N | Y |  |
| green chilli | count | exact | green chili pepper | N | Y |  |
| tinned plum tomatoes | count | exact | peeled tomatoes | N | P | can weight is a pack size |
| ground coriander | volume | parent only | coriander seed | N | Y | no ground vs whole split |
| ground turmeric | volume | exact | turmeric | Y | Y |  |
| red chilli | count | exact | red chili pepper | N | Y |  |
| garam masala | volume | exact | garam masala | Y | N |  |
| naan bread | count | parent only | bread | Y | Y |  |
| bay leaf | count | exact | bay leaf | Y | N |  |
| green cardamom pods | count | parent only | cardamom | N | N | no pod weight anywhere |
| cinnamon stick | count | exact | cinnamon stick | N | N | no stick weight anywhere |
| balti curry paste | volume | parent only | curry paste | P | N |  |
| raisins | volume | exact | raisin | P | N |  |
| flaked almonds | volume | exact | flaked almonds | P | Y |  |
| orzo | weight | parent only | pasta | - | - |  |
| roasted red peppers | weight | parent only | red bell pepper | - | - | no jarred or roasted forms |
| courgette | count | exact | courgette | Y | Y |  |
| white fish fillet | count | exact | white fish | Y | Y |  |
| parmesan | weight | exact | parmigiano reggiano | - | - |  |
| passata | weight | exact | tomato purée | - | - |  |
| fresh lasagne sheets | weight | exact | lasagne | - | - |  |
| rocket | weight | exact | rocket | - | - |  |
| extra virgin olive oil | volume | exact | extra virgin olive oil | N | Y |  |
| whole chicken | weight | exact | whole chicken | - | - |  |
| celery | count | exact | celery | Y | Y |  |
| mixed fresh herbs | count | exact | herb | N | N | bunch in neither |
| sweet potato | count | exact | sweet potato | N | Y | I24 has no raw sweet potato |
| smoked paprika | volume | exact | smoked paprika | Y | Y |  |
| dried oregano | volume | exact | oregano | Y | Y |  |
| black beans | count | exact | black bean | N | P | USDA cup only, no can |
| lime | count | exact | lime | P | Y |  |
| guacamole | volume | exact | guacamole | P | N |  |
| rice | weight | exact | rice | - | - |  |
| vine tomatoes | count | exact | tomato | Y | Y |  |
| cucumber | count | exact | cucumber | N | Y |  |
| kalamata olives | count | exact | kalamata olive | Y | Y |  |
| feta | weight | exact | feta | - | - |  |
| sunflower oil | volume | exact | sunflower oil | N | Y |  |
| spring onion | count | exact | spring onion | Y | Y |  |
| natural yoghurt | volume | exact | plain yogurt | N | Y |  |
| mince | weight | exact | minced beef | - | - | no generic mince; UK mince taken as beef |
| worcestershire sauce | volume | exact | worcestershire sauce | Y | Y |  |
| cheese | weight | exact | cheese | - | - |  |
| boneless chicken thighs | count | exact | chicken thigh | P | Y | I24 roast thigh with skin only |
| tikka paste | volume | parent only | curry paste | P | N |  |
| cumin seeds | volume | exact | cumin seeds | Y | Y |  |
| crusty bread | count | parent only | bread | Y | Y |  |
| stewing beef | weight | parent only | beef | - | - | chuck steak exists, stewing steak does not |
| ale | volume | parent only | beer | N | Y |  |
