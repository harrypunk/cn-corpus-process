CREATE TABLE `authors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) COLLATE utf8mb4_bin NOT NULL,
	`dynasty` varchar(64) COLLATE utf8mb4_bin NOT NULL DEFAULT '',
	`description` text,
	CONSTRAINT `authors_id` PRIMARY KEY(`id`),
	CONSTRAINT `authors_name_dynasty` UNIQUE(`name`,`dynasty`)
);
--> statement-breakpoint
CREATE TABLE `poems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`author_id` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`content` text NOT NULL,
	`source` varchar(64) NOT NULL,
	CONSTRAINT `poems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `poems` ADD CONSTRAINT `poems_author_id_authors_id_fk` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_poems_author` ON `poems` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_poems_title` ON `poems` (`title`);