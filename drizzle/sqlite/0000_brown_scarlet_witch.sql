CREATE TABLE `authors` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`dynasty` text DEFAULT '' NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_name_dynasty` ON `authors` (`name`,`dynasty`);--> statement-breakpoint
CREATE TABLE `poems` (
	`id` integer PRIMARY KEY NOT NULL,
	`author_id` integer NOT NULL,
	`title` text NOT NULL,
	`title_search` text NOT NULL,
	`content` text NOT NULL,
	`content_search` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_poems_author` ON `poems` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_poems_title` ON `poems` (`title`);--> statement-breakpoint
CREATE INDEX `idx_poems_title_search` ON `poems` (`title_search`);--> statement-breakpoint
CREATE TABLE `sentences` (
	`id` integer PRIMARY KEY NOT NULL,
	`poem_id` integer NOT NULL,
	`seq` integer NOT NULL,
	`text` text NOT NULL,
	`text_search` text NOT NULL,
	`parts` integer NOT NULL,
	FOREIGN KEY (`poem_id`) REFERENCES `poems`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sentences_poem` ON `sentences` (`poem_id`);