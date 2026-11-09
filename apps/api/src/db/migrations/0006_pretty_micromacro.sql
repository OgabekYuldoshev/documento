CREATE TABLE `api_key` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL,
	`scope` text NOT NULL,
	`allowed_template_ids` text,
	`rate_limit_per_min` integer DEFAULT 60 NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`last_used_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_prefix_unique` ON `api_key` (`prefix`);--> statement-breakpoint
CREATE INDEX `api_key_project_idx` ON `api_key` (`project_id`);--> statement-breakpoint
ALTER TABLE `generation` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `generation_idempotency_uq` ON `generation` (`api_key_id`,`idempotency_key`) WHERE "generation"."idempotency_key" is not null;