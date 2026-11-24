// Small, hand-made stand-ins for the three pinned sources and the own layer,
// shaped like the real files, so the build is tested without the network.
import { parseIntake24 } from '../sources/intake24.ts'
import { parseOffTaxonomy } from '../sources/off.ts'
import { parseUsda } from '../sources/usda.ts'
import { parseOwnLayer, type OwnLayer } from '../own.ts'
import type { SourcePins } from '../sources/pins.ts'

export const offText = `# Properties for ingredients
# vegan:en can have values yes, no, maybe

stopwords:en: of, the

synonyms:en: colour, color

en: Vegetable
vegan:en: yes
vegetarian:en: yes

< en:vegetable
en: Onion, Onions, Bulb onion
wikidata:en: Q23400
ciqual_food_code:en: 20034
vegan:en: yes
vegetarian:en: yes
fr: Oignon

< en:onion
en: Red onion, Red onions

< en:onion
en: Onion powder
vegetarian:en: maybe

en: Animal product

< en:animal-product
en: Chicken
vegan:en: no
vegetarian:en: no

< en:chicken
en: Chicken stock, Chicken broth
vegetarian:en: no

< en:chicken
en: Chicken breast

< en:animal-product
en: Dairy

< en:dairy
en: Cheese
vegan:en: no
vegetarian:en: yes

< en:cheese
en: Cheddar
fr: Cheddar

< en:vegetable
en: Tomato

< en:tomato
en: Tomato puree, Tomato purée

< en:tomato
en: Tomato concentrate, Tomato paste

fr: Seulement francais

en: Wheat flour
`

export const intake24Xml = `<?xml version='1.0' encoding='utf-8'?>
<foods>
  <food code="ONNS" description="Onions, raw" groupCode="70">
    <portion-size method="standard-portion" description="use_a_standard_portion" imageUrl="x.jpg" useForRecipes="true">
      <param name="units-count" value="4"/>
      <param name="unit0-name" value="tablespoons"/>
      <param name="unit0-omit-food-description" value="false"/>
      <param name="unit0-weight" value="11.7"/>
      <param name="unit1-name" value="small_onions"/>
      <param name="unit1-omit-food-description" value="true"/>
      <param name="unit1-weight" value="60.0"/>
      <param name="unit2-name" value="medium_onions"/>
      <param name="unit2-omit-food-description" value="true"/>
      <param name="unit2-weight" value="150.0"/>
      <param name="unit3-name" value="large_onions"/>
      <param name="unit3-omit-food-description" value="true"/>
      <param name="unit3-weight" value="240.0"/>
    </portion-size>
    <portion-size method="guide-image" description="in_a_can" imageUrl="g.jpg" useForRecipes="false">
      <param name="guide-image-id" value="Gcans"/>
    </portion-size>
  </food>
  <food code="CHBR" description="Chicken breast, raw" groupCode="1">
    <portion-size method="standard-portion" description="s" imageUrl="x.jpg" useForRecipes="true">
      <param name="units-count" value="1"/>
      <param name="unit0-name" value="fillets"/>
      <param name="unit0-weight" value="120.0"/>
    </portion-size>
  </food>
</foods>
`

export const usdaFiles = {
  food: `"fdc_id","data_type","description","food_category_id","publication_date"
"170000","sr_legacy_food","Onions, raw","11","2019-04-01"
"171000","sr_legacy_food","Cheese, cheddar","1","2019-04-01"
`,
  measureUnit: `"id","name"
"1000","cup"
"1001","tablespoon"
"1002","teaspoon"
"1019","can"
`,
  portion: `"id","fdc_id","seq_num","amount","measure_unit_id","portion_description","modifier","gram_weight","data_points","footnote","min_year_acquired"
"85855","170000","1","1","9999","","cup, chopped","160","","",""
"85857","170000","3","1","9999","","tbsp chopped","10","","",""
"85858","170000","4","1","9999","","large","150","","",""
"85860","170000","6","1","9999","","medium (2-1/2"" dia)","110","","",""
"85862","170000","8","1","9999","","small","70","","",""
"85864","170000","10","10","9999","","rings","60","","",""
"85865","170000","11","1","9999","","oz","28.35","","",""
"85866","170000","12","1","9999","","cup, cooked, excluding refuse","200","","",""
"90001","171000","1","1","1000","","","113","","",""
"90002","171000","2","1","1001","","","7.1","","",""
"90003","171000","3","1","9999","","slice (1 oz)","28","","",""
"90004","171000","4","1","1019","","","190","","",""
`,
}

export const pins: SourcePins = {
  off: {
    repo: 'openfoodfacts/openfoodfacts-server',
    commit: 'a'.repeat(40),
    path: 'taxonomies/food/ingredients.txt',
    url: 'https://example.invalid/ingredients.txt',
    sha256: 'b'.repeat(64),
  },
  intake24: {
    repo: 'intake24-legacy/xml-data',
    commit: 'c'.repeat(40),
    path: 'foods.xml',
    url: 'https://example.invalid/foods.xml',
    sha256: 'd'.repeat(64),
  },
  usda: {
    release: 'FoodData Central SR Legacy 2018-04',
    url: 'https://example.invalid/sr.zip',
    sha256: 'e'.repeat(64),
  },
}

export const ownFiles: Record<string, string> = {
  'ingredients.yaml': `
- key: plain-flour
  slug: plain-flour
  name: Plain flour
  parents: [wheat-flour]
- key: bicarbonate-of-soda
  slug: bicarbonate-of-soda
  name: Bicarbonate of soda
`,
  'names.yaml': `
- ingredient: tomato-concentrate
  lang: en-gb
  display_name: Tomato purée
  names: [tomato puree, tomato purée]
- ingredient: onion
  lang: en-gb
  names: [yellow onion]
`,
  'edges.yaml': `
- child: chicken-stock
  parent: chicken
  op: reclassify
  kind: made_from
- child: onion-powder
  parent: onion
  op: reclassify
  kind: made_from
`,
  'dietary.yaml': `
- ingredient: vegetable
  properties:
    contains_meat_poultry: 'no'
    contains_gluten: 'no'
- ingredient: chicken
  properties:
    contains_meat_poultry: 'yes'
`,
  'measures.yaml': `
- ingredient: onion
  canonical:
    dimension: count
    item_name: onion
    default_size: medium
    set_by: owner
- ingredient: cheddar
  item_weights:
    - name: slice
      grams: 25
      default: true
      quality: estimate
- ingredient: chicken-breast
  density:
    g_per_ml: 1.05
    quality: proxy
`,
  'packs.yaml': `
- ingredient: tomato-concentrate
  noun: tube
  amount: 200
  unit: g
`,
  'aisles.yaml': `
- ingredient: vegetable
  aisle: fruit-and-veg
- ingredient: chicken-stock
  aisle: cupboard
`,
  'links.yaml': `
- ingredient: onion
  intake24: ONNS
  usda: '170000'
- ingredient: cheddar
  usda: '171000'
- ingredient: chicken-breast
  intake24: CHBR
`,
  'protein-branches.yaml': `
- protein: chicken
  nodes: [chicken]
`,
  'expectations.yaml': `
- name: tomato purée
  slug: tomato-concentrate
- name: Tomato paste
  slug: tomato-concentrate
`,
}

export function fixtureInputs(own: Record<string, string> = ownFiles): {
  pins: SourcePins
  off: ReturnType<typeof parseOffTaxonomy>
  intake24: ReturnType<typeof parseIntake24>
  usda: ReturnType<typeof parseUsda>
  own: OwnLayer
} {
  return {
    pins,
    off: parseOffTaxonomy(offText),
    intake24: parseIntake24(intake24Xml),
    usda: parseUsda(usdaFiles),
    own: parseOwnLayer(own),
  }
}
