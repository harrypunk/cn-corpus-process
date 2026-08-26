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
	`content` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_poems_author` ON `poems` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_poems_title` ON `poems` (`title`);