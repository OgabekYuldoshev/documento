CREATE TABLE `upload` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`api_key_id` text,
	`format` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`width` integer,
	`height` integer,
	`storage_key` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `upload_project_idx` ON `upload` (`project_id`);--> statement-breakpoint
CREATE INDEX `upload_expires_idx` ON `upload` (`expires_at`);