CREATE TYPE "public"."units" AS ENUM('uk_metric');--> statement-breakpoint
CREATE TABLE "household" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_servings" integer DEFAULT 2 NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"units" "units" DEFAULT 'uk_metric' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_user" (
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_user_household_id_user_id_pk" PRIMARY KEY("household_id","user_id"),
	CONSTRAINT "household_user_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "household_user" ADD CONSTRAINT "household_user_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_user" ADD CONSTRAINT "household_user_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;