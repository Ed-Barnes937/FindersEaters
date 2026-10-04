# Spike: open food data and stock library sources

Date: 2026-09-25. Scope: which open sources can (a) seed the Food Knowledge Base and
(b) supply a Stock Library, with the UK as the default location. Not legal advice.

Marking: **V** means I checked it against the primary source (licence page, official
site, or by downloading the data) on 2026-09-25. **I** means it is my inference or
from memory and has not been checked.

## Summary and recommendation

**Knowledge base.** No single source covers the whole need, but four open sources
together cover most of it, and all four permit commercial use.

1. The Open Food Facts ingredients taxonomy is the best starting skeleton. It is a
   curated hierarchy of about 4,800 English ingredient entries with synonyms
   ("Courgette, zucchini", "coriander leaf, coriander leaves, cilantro"), vegan,
   vegetarian and allergen properties, and links to Wikidata and CIQUAL codes. Its
   hierarchy is shallow in places (cheddar sits directly under cheese, not hard
   cheese) and UK cooking names such as "plain flour" are missing, so it is a seed,
   not a finished ontology. It is ODbL, which brings share-alike (see below).
2. Intake24's UK food database (OGL v3.0) supplies UK portion weights. For "Onions,
   raw" it gives small 60g, medium 150g and large 240g. USDA gives 110g for a
   medium onion, so UK-sourced weights matter.
3. USDA FoodData Central SR Legacy (CC0) fills gaps in portion weights and gives
   cup weights (1 cup all-purpose flour = 125g), from which densities follow.
4. Wikidata (CC0) supplies en-gb vs en labels (Q7533 is "zucchini" in en and
   "courgette" in en-gb) and cross-links to other identifiers.

CoFID (OGL) is useful later for UK food names, food groups and nutrition, but has
no portion or density data. FoodOn (CC BY 4.0) is a good reference for the
hierarchy but is too big and too science-oriented to adopt wholesale. The FAO
density database is non-commercial, so it should be avoided. For pack sizes and
aisles, Open Food Facts has about 195,000 UK products with a quantity field and
category tags, so typical pack sizes can be derived statistically (I).

**Stock library.** I found no open recipe collection that is at once good quality,
UK-leaning and safe for a product that might become commercial. The large research
datasets (RecipeNLG, Recipe1M, Food.com) are either explicitly non-commercial or are
scrapes with no rights from the original sites. TheMealDB allows app use for paid
supporters, but most of its British recipes cite BBC Good Food as their source.
NHS Healthier Families (196 recipes) is Crown copyright and is not under the OGL,
so commercial use needs a licence. Wikibooks Cookbook (CC BY-SA 4.0) is truly
open, but its UK section is small (about 60 pages) and uneven in quality.

So I recommend **authoring our own stock library of about 300 to 500 recipes**. An
LLM drafts each one from a dish list we choose (UK household staples first) straight
into our structured schema. The engine then parses each draft as an acceptance
test, and a human reviews every recipe and test-cooks a sample. Two cheap parallel
tracks are worth running. We could ask OHID/NHS for a licence to the Healthier
Families recipes, and we could use Wikibooks recipes (with attribution, share-alike
on that text) as a clearly separated extra tier if we want more volume.

**ODbL caution (I).** Under ODbL s4.4, if we publicly use a database derived from
Open Food Facts (and shipping the knowledge base to clients probably counts), that
derived database must itself be offered under ODbL. The app's screens are a
"Produced Work" and only need an attribution notice (s4.3). The way to manage this
is to keep OFF-derived data in its own layer, separate from our own additions, and
to accept that the OFF-derived layer is open. That seems acceptable for a
knowledge base, since the product's value is in the engine and the user data.

## (a) Food knowledge base sources

| Source | Contains | Size | Licence and obligations | UK fit | Format / status | Fit |
|---|---|---|---|---|---|---|
| **Open Food Facts ingredients taxonomy** | Ingredient hierarchy (`< en: parent`), multilingual synonyms, vegan/vegetarian/allergen props, a few densities (`density_g_per_ml`, sourced from FAO), Wikidata and CIQUAL links | About 99k lines, 4,819 en entries, 6,122 parent links, 1,271 Wikidata links, 925 CIQUAL codes (V, counted) | Database ODbL 1.0, contents DbCL 1.0 (V). Commercial use allowed. Attribution plus share-alike on derived databases (V, ODbL s4.3-4.4). Repo code is AGPL-3.0 (V). Taxonomy files are not separately licensed, so treating them as ODbL is (I) | Good: British and US names both present | Plain text in GitHub, actively maintained (V) | **Primary skeleton** for names, aliases, hierarchy, dietary |
| **Open Food Facts products** | Products with categories taxonomy, `quantity` (pack size), brands, stores | 4.77M products, 195k tagged UK (V, API count) | As above. Images CC BY-SA 3.0 (V) | Good for UK packs; no aisle field (I) | Nightly CSV/JSONL/Parquet dumps, API (V) | **Pack sizes and category-to-aisle mapping**, derived (I) |
| **Intake24 UK food database** | UK foods with portion methods; 1,288 "standard-portion" entries giving named-unit weights (e.g. medium onion 150g, 1 tbsp 11.7g) | 2,527 foods in foods.xml (V, counted) | OGL v3.0 (V). Commercial use allowed, attribution, no share-alike (V) | Excellent: built for the UK NDNS survey | XML on GitHub; legacy repo archived Jul 2025 (V). Current DB is available on request (V) | **Primary for UK portion weights** |
| **USDA FoodData Central** (SR Legacy, FNDDS, Foundation) | Nutrients plus `food_portion` household measures with gram weights | SR Legacy: 7,793 foods, 14,449 portion rows (V, counted). Final release 2018 (V). Foundation and Branded updated Apr 2026 (V) | CC0 1.0, citation requested (V) | US names and cup measures | CSV/JSON dumps and API (V) | **Fallback portion weights and cup-to-gram densities** |
| **Wikidata** food items | Labels per locale (en, en-gb, en-us), aliases, taxonomy, identifiers | Very large (I) | CC0, no attribution needed (V) | Good: en-gb labels exist, e.g. courgette (V) | SPARQL, API, dumps | **UK/US alias layer and cross-IDs**. Items can conflate plant, leaf and seed (coriander Q41611), so they need curating (V) |
| **CoFID** (McCance and Widdowson's 2021) | UK nutrient composition, UK food names, food group codes, edible proportion | About 2,887 foods (V, counted rows) | OGL v3.0 (V) | Excellent (the UK reference) | Excel, last updated 19 Mar 2021 (V) | **Later**: nutrition and UK naming. No portions or densities (V) |
| **FoodOn** | Formal food ontology (OWL), synonyms TSV | 9,600+ generic food product categories (search result, not checked on source) | CC BY 4.0 (V): attribution | Neutral, somewhat US/scientific (I) | OWL/TSV, active (1,700+ commits) (V) | **Reference** for hierarchy gaps, too heavy to adopt whole (I) |
| **LanguaL** | Faceted food description thesaurus | 12,605 descriptors, version 2017 (V) | No licence found on the site (V) | EU | Thesaurus; FoodOn is named as its successor (V) | **Skip** |
| **FAO/INFOODS Density DB v2** | Volume-to-weight densities | 638 entries (search result) | CC BY-NC-SA 3.0 IGO (search result, not checked on source) | Neutral | Excel/PDF | **Avoid**: non-commercial |
| **GS1 GPC** | Retail product classification (segment, family, class, brick) | Large (I) | Free browser and download (V), licence terms not found | Global retail | JSON/XML/XLSX (V) | Possible aisle taxonomy; licence unverified |
| **UK 14 allergens** | Legal allergen list | 14 | Legislation (I) | UK law | n/a | Use as the fixed allergen dimension (I) |

**Parser golden test sets**

| Source | Contains | Licence | Fit |
|---|---|---|---|
| NYT ingredient-phrase-tagger | About 180k labelled US ingredient phrases (2015 snapshot) | Repo Apache 2.0, archived Mar 2019 (V). NYT's rights in the phrases themselves are unclear (I) | Good US test set, weak on metric and UK phrasing |
| strangetom/ingredient-parser | 81k+ labelled sentences: NYT 30k, BBC 15k, AllRecipes 15k, Cookstr 15k, Taste of Home 6.3k (V) | Repo MIT (V). The BBC, AllRecipes and Cookstr sentences come from a 2017 Internet Archive scrape (V), so rights are unclear (I) | Best UK-style labels (BBC, metric). Use internally for evaluation only (I). Also a strong baseline parser to benchmark against Jev |
| Our own UK golden set | Hand-labelled lines from our users' imports | Ours | **Needed anyway.** Build it from the first real imports (I) |

## (b) Stock library sources

| Source | Contains | Size | Licence | Commercial? | UK fit | Fit |
|---|---|---|---|---|---|---|
| **RecipeNLG** | Scraped recipes (title, ingredients, directions) | 2,231,142 (V) | Download terms: "only for non-commercial research and educational purposes" (V) | **No** | Mostly US (I) | Exclude; research only |
| **Recipe1M / Recipe1M+** | Scraped recipes with images | About 1M (I) | "granted only for research purposes to universities and research institutions" (V) | **No** | Mostly US (I) | Exclude |
| **Food.com (Kaggle, shuyangli94)** | 180k+ recipes, 700k reviews (V) | 180k | Kaggle licence "Data files © Original Authors" (V) | **No** | US | Exclude |
| **Food.com (Kaggle, irkaal)** | Food.com recipes and reviews | about 1.5GB (V) | Labelled CC0 by the uploader (V), who does not own Food.com content (I) | Not safely | US | Exclude: the label does not clean the provenance |
| **TheMealDB** | Recipes with images, area/category tags, ingredient list | 793 meals, 60 British (V) | Terms: free tier cannot publish to app stores; paid supporters ($10 one-off) may; attribution; no reselling (V) | Yes, if paid (V) | 60 British, but 18 of the first 25 cite BBC Good Food or bbc.co.uk as source (V) | **Risky**: TheMealDB cannot grant rights it may not hold (I) |
| **Wikibooks Cookbook** | Community recipes, often metric plus imperial (e.g. Shepherd's Pie, 13 steps) (V) | 3,828 pages in Category:Recipes; English 45, British 7, Cornish 10 (V) | CC BY-SA 4.0 (V): attribution, share-alike on adapted text | Yes (V) | Small UK section | **Usable** as a separate, attributed tier; quality varies (I) |
| **NHS Healthier Families** | Healthy family recipes | 196 (V) | Crown copyright; "must not use any part of the content ... for commercial purposes without obtaining a licence" (V). Not OGL (V) | **No**, without a licence | Excellent | **Ask for a licence**; good UK, family-oriented set |
| **Project Gutenberg cookbooks** | Mrs Beeton (1861), Robert May, Lady Charlotte Bury and others (V) | Dozens of books (V) | Public domain; remove Gutenberg branding for commercial use (V). Beeton died 1865, so public domain in the UK too (I) | Yes | Very British, but Victorian | Curiosity only; would need heavy modernising (I) |
| **USDA MyPlate Kitchen** | Healthy US recipes | About 1,000 to 2,300 (third-party claim) | US federal works are public domain under 17 USC 105 (I). The original site returned 403; a third-party mirror claims it was retired Jan 2026 (unverified). Some recipes may come from partners (I) | Probably, for USDA-authored ones | US | Low priority; US measures and tastes |
| **Foodista** | Wiki-style recipes | "Several hundred thousand entries" (Wikipedia) | CC BY 4.0 (search result; legal page rate-limited) | Probably | US | Check provenance per recipe before any use (I) |
| **Open Food Facts recipes** | None found | n/a | n/a | n/a | n/a | OFF does not host recipes (I) |

## Copyright position on recipes (UK)

Facts first. UK copyright protects original literary works under the Copyright,
Designs and Patents Act 1988, and UK courts apply the "author's own intellectual
creation" test for originality (V, secondary source). There is no UK statute or
leading case specific to recipes that I could find. The US Copyright Office states
that "a mere listing of ingredients ... or a simple set of directions, is
uncopyrightable", while creative explanation, photos and a cookbook's selection can
be protected (V, Circular 33).

UK commentary reaches the same split (I, secondary sources). An ingredient list is
functional and unlikely to be protected. A method written with any expressive
length probably is, as are photos and headnotes. On top of copyright, the UK has
the sui generis database right, and "repeated and systematic extraction" of a
site's recipes can infringe it even where each recipe is unprotected (V, reg 16 of
the 1997 Regulations). The UK text and data mining exception covers
non-commercial research only (V, CDPA s29A), so it cannot justify scraping for a
product.

Put together, re-using facts (dish, ingredients, quantities) is low risk. Copying
method text, photos or whole collections is not. **So a stock library must have
freshly written methods and our own or licensed photos.** The same reasoning
supports Principle 1: users importing recipes for personal use is different from
us redistributing them.

## Generating the stock library with an LLM

**Quality (I).** A strong LLM writes plausible, conventional recipes well. Its
typical failures are wrong quantities (too much salt, liquid ratios off), timings
that don't survive a real oven, and bland consensus versions of dishes. These are
the same fields our engine parses, so every draft can be machine-checked: it must
parse cleanly, quantities must fall in sane per-serving ranges, and tags must come
out of the hierarchy. Human review of every recipe plus test-cooking a sample (say
10 to 20 percent, and every baking recipe) brings quality up to the level a user
will trust.

**Legal (I, except where marked).** Generated text is not copied text, so the main
risk is memorised passages from well-known recipes. We can reduce that by
prompting from our own dish list and structure, never from a source recipe. A
similarity check against the big scraped corpora (used internally only) would catch
near-copies. The UK is unusual in giving computer-generated works an author, "the
person by whom the arrangements necessary for the creation of the work are
undertaken" (V, CDPA s9(3)), which suggests we would own the output. The model
provider's terms need checking for output ownership before relying on this.

**Why it wins here (I).** It is the only path that gives UK-first recipes in our
exact schema, with metric quantities, our tags and clean rights. The cost is
review time. With a few hundred recipes, that is bounded.

## Sources

- CoFID: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
- Open Government Licence v3.0: https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
- FoodData Central downloads: https://fdc.nal.usda.gov/download-datasets/ ; licence (CC0): https://data.nal.usda.gov/dataset/fooddata-central-0
- SR Legacy CSV (checked locally): https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
- Intake24 open source and licences: https://intake24.org/open-source ; data repo: https://github.com/intake24-legacy/xml-data
- Open Food Facts terms: https://world.openfoodfacts.org/terms-of-use ; data: https://world.openfoodfacts.org/data
- OFF taxonomies: https://github.com/openfoodfacts/openfoodfacts-server/tree/main/taxonomies/food
- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- Wikidata licensing: https://www.wikidata.org/wiki/Wikidata:Licensing ; example items Q7533, Q41611
- FoodOn: https://github.com/FoodOntology/foodon ; https://foodon.org/
- LanguaL: https://www.langual.org/
- FAO/INFOODS density DB: https://www.fao.org/infoods/infoods/tables-and-databases/faoinfoods-databases/en/ ; https://openknowledge.fao.org/handle/20.500.14283/ap815e
- GS1 GPC browser: https://gpc-browser.gs1.org/
- NYT tagger: https://github.com/nytimes/ingredient-phrase-tagger
- ingredient-parser: https://github.com/strangetom/ingredient-parser ; data: https://ingredient-parser.readthedocs.io/en/latest/explanation/data.html
- RecipeNLG: https://recipenlg.cs.put.poznan.pl/dataset ; https://github.com/Glorf/recipenlg
- Recipe1M: https://github.com/torralba-lab/im2recipe-Pytorch
- Food.com (Kaggle): https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions ; https://www.kaggle.com/datasets/irkaal/foodcom-recipes-and-reviews
- TheMealDB: https://www.themealdb.com/ ; terms: https://www.themealdb.com/terms_of_use.php ; API: https://www.themealdb.com/api.php
- Wikibooks Cookbook: https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents ; https://en.wikibooks.org/wiki/Category:British_recipes
- NHS Healthier Families: https://www.nhs.uk/healthier-families/recipes/ ; terms: https://www.nhs.uk/healthier-families/terms-and-conditions/
- Project Gutenberg licence: https://www.gutenberg.org/policy/license.html ; Mrs Beeton: https://www.gutenberg.org/ebooks/10136
- MyPlate mirror (third party): https://myplate.food/recipes
- Foodista: https://en.wikipedia.org/wiki/Foodista.com
- US Copyright Office Circular 33: https://www.copyright.gov/circs/circ33.pdf
- CDPA 1988 s9 and s29A: https://www.legislation.gov.uk/ukpga/1988/48/section/9 ; https://www.legislation.gov.uk/ukpga/1988/48/section/29A
- Database right, reg 16: https://www.legislation.gov.uk/uksi/1997/3032/regulation/16
- UK originality commentary: https://www.fieldfisher.com/en/services/intellectual-property/intellectual-property-blog/originality-in-the-uk-means-the-author-s-own-intellectual-creation-including-for-software-generated-works-%20the-debate-is-over-for-now
