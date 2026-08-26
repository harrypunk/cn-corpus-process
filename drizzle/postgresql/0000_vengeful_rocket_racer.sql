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
	"content" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poems" ADD CONSTRAINT "poems_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authors_name_dynasty" ON "authors" USING btree ("name","dynasty");--> statement-breakpoint
CREATE INDEX "idx_poems_author" ON "poems" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_poems_title" ON "poems" USING btree ("title");