CREATE SCHEMA "kb";
--> statement-breakpoint
CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE TYPE "kb"."dimension" AS ENUM('count', 'volume', 'mass');--> statement-breakpoint
CREATE TYPE "kb"."edge_kind" AS ENUM('is_a', 'made_from');--> statement-breakpoint
CREATE TYPE "kb"."fact_quality" AS ENUM('source', 'proxy', 'estimate');--> statement-breakpoint
CREATE TYPE "kb"."fact_source" AS ENUM('off', 'intake24', 'usda', 'own');--> statement-breakpoint
CREATE TYPE "kb"."pack_unit" AS ENUM('g', 'ml', 'count');--> statement-breakpoint
CREATE TYPE "kb"."set_by" AS ENUM('agent', 'owner');--> statement-breakpoint
CREATE TYPE "kb"."tri_state" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
CREATE TABLE "kb"."aisle" (
	"ingredient_id" uuid PRIMARY KEY NOT NULL,
	"aisle" text NOT NULL,
	"source" "kb"."fact_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb"."ancestor" (
	"node_id" uuid NOT NULL,
	"ancestor_id" uuid NOT NULL,
	CONSTRAINT "ancestor_node_id_ancestor_id_pk" PRIMARY KEY("node_id","ancestor_id")
);
--> statement-breakpoint
CREATE TABLE "kb"."density" (
	"ingredient_id" uuid PRIMARY KEY NOT NULL,
	"grams_per_ml" double precision NOT NULL,
	"source" "kb"."fact_source" NOT NULL,
	"quality" "kb"."fact_quality" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb"."ingredient" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"off_id" text,
	"wikidata_id" text,
	"ciqual_id" text,
	"display_name" text NOT NULL,
	"source" "kb"."fact_source" NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	"replaced_by" uuid,
	"canonical_dimension" "kb"."dimension",
	"canonical_item_name" text,
	"canonical_default_size" text,
	"canonical_set_by" "kb"."set_by",
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_slug_unique" UNIQUE("slug"),
	CONSTRAINT "ingredient_off_id_unique" UNIQUE("off_id")
);
--> statement-breakpoint
CREATE TABLE "kb"."ingredient_edge" (
	"child_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"kind" "kb"."edge_kind" NOT NULL,
	"source" "kb"."fact_source" NOT NULL,
	CONSTRAINT "ingredient_edge_child_id_parent_id_pk" PRIMARY KEY("child_id","parent_id")
);
--> statement-breakpoint
CREATE TABLE "kb"."ingredient_name" (
	"ingredient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalised" text NOT NULL,
	"lang" text NOT NULL,
	"source" "kb"."fact_source" NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "ingredient_name_ingredient_id_name_lang_pk" PRIMARY KEY("ingredient_id","name","lang")
);
--> statement-breakpoint
CREATE TABLE "kb"."ingredient_property" (
	"ingredient_id" uuid NOT NULL,
	"property" text NOT NULL,
	"value" "kb"."tri_state" NOT NULL,
	"source" "kb"."fact_source" NOT NULL,
	CONSTRAINT "ingredient_property_ingredient_id_property_pk" PRIMARY KEY("ingredient_id","property")
);
--> statement-breakpoint
CREATE TABLE "kb"."ingredient_slug_alias" (
	"slug" text PRIMARY KEY NOT NULL,
	"ingredient_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb"."item_weight" (
	"ingredient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"grams" double precision NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"source" "kb"."fact_source" NOT NULL,
	"quality" "kb"."fact_quality" NOT NULL,
	CONSTRAINT "item_weight_ingredient_id_name_pk" PRIMARY KEY("ingredient_id","name")
);
--> statement-breakpoint
CREATE TABLE "kb"."pack" (
	"ingredient_id" uuid NOT NULL,
	"noun" text NOT NULL,
	"amount" double precision NOT NULL,
	"unit" "kb"."pack_unit" NOT NULL,
	"source" "kb"."fact_source" NOT NULL,
	"quality" "kb"."fact_quality" NOT NULL,
	CONSTRAINT "pack_ingredient_id_noun_pk" PRIMARY KEY("ingredient_id","noun")
);
--> statement-breakpoint
CREATE TABLE "kb"."protein_branch" (
	"protein" text NOT NULL,
	"ingredient_id" uuid NOT NULL,
	CONSTRAINT "protein_branch_protein_ingredient_id_pk" PRIMARY KEY("protein","ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "ops"."meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kb"."aisle" ADD CONSTRAINT "aisle_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."ancestor" ADD CONSTRAINT "ancestor_node_id_ingredient_id_fk" FOREIGN KEY ("node_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."ancestor" ADD CONSTRAINT "ancestor_ancestor_id_ingredient_id_fk" FOREIGN KEY ("ancestor_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."density" ADD CONSTRAINT "density_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."ingredient" ADD CONSTRAINT "ingredient_replaced_by_ingredient_id_fk" FOREIGN KEY ("replaced_by") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."ingredient_edge" ADD CONSTRAINT "ingredient_edge_child_id_ingredient_id_fk" FOREIGN KEY ("child_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."ingredient_edge" ADD CONSTRAINT "ingredient_edge_parent_id_ingredient_id_fk" FOREIGN KEY ("parent_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."ingredient_name" ADD CONSTRAINT "ingredient_name_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."ingredient_property" ADD CONSTRAINT "ingredient_property_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."ingredient_slug_alias" ADD CONSTRAINT "ingredient_slug_alias_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."item_weight" ADD CONSTRAINT "item_weight_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."pack" ADD CONSTRAINT "pack_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."protein_branch" ADD CONSTRAINT "protein_branch_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "kb"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ancestor_ancestor_idx" ON "kb"."ancestor" USING btree ("ancestor_id");--> statement-breakpoint
CREATE INDEX "ingredient_replaced_by_idx" ON "kb"."ingredient" USING btree ("replaced_by");--> statement-breakpoint
CREATE INDEX "ingredient_edge_parent_idx" ON "kb"."ingredient_edge" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "ingredient_name_normalised_idx" ON "kb"."ingredient_name" USING btree ("normalised");--> statement-breakpoint
CREATE INDEX "ingredient_slug_alias_ingredient_idx" ON "kb"."ingredient_slug_alias" USING btree ("ingredient_id");