CREATE TABLE `authors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) COLLATE utf8mb4_bin NOT NULL,
	`dynasty` varchar(64) COLLATE utf8mb4_bin NOT NULL DEFAULT '',
	`description` text,
	CONSTRAINT `authors_id` PRIMARY KEY(`id`),
	CONSTRAINT `authors_name_dynasty` UNIQUE(`name`,`dynasty`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `poems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`author_id` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`title_search` varchar(512) NOT NULL,
	`content` text NOT NULL,
	`content_search` text NOT NULL,
	`source` varchar(64) NOT NULL,
	CONSTRAINT `poems_id` PRIMARY KEY(`id`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `sentences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`poem_id` int NOT NULL,
	`seq` int NOT NULL,
	`text` text NOT NULL,
	`text_search` text NOT NULL,
	`parts` int NOT NULL,
	CONSTRAINT `sentences_id` PRIMARY KEY(`id`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `poems` ADD CONSTRAINT `poems_author_id_authors_id_fk` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sentences` ADD CONSTRAINT `sentences_poem_id_poems_id_fk` FOREIGN KEY (`poem_id`) REFERENCES `poems`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_poems_author` ON `poems` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_poems_title` ON `poems` (`title`);--> statement-breakpoint
CREATE INDEX `idx_poems_title_search` ON `poems` (`title_search`);--> statement-breakpoint
CREATE INDEX `idx_sentences_poem` ON `sentences` (`poem_id`);