CREATE TABLE "authors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"dynasty" text DEFAULT '' NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "poems" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"title" text NOT NULL,
	"title_search" text NOT NULL,
	"content" text NOT NULL,
	"content_search" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentences" (
	"id" serial PRIMARY KEY NOT NULL,
	"poem_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"text" text NOT NULL,
	"text_search" text NOT NULL,
	"parts" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poems" ADD CONSTRAINT "poems_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentences" ADD CONSTRAINT "sentences_poem_id_poems_id_fk" FOREIGN KEY ("poem_id") REFERENCES "public"."poems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authors_name_dynasty" ON "authors" USING btree ("name","dynasty");--> statement-breakpoint
CREATE INDEX "idx_poems_author" ON "poems" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_poems_title" ON "poems" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_poems_title_search" ON "poems" USING btree ("title_search");--> statement-breakpoint
CREATE INDEX "idx_sentences_poem" ON "sentences" USING btree ("poem_id");