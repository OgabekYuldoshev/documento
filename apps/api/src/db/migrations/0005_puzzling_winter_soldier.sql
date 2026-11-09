CREATE TABLE `generation` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`template_id` text NOT NULL,
	`template_version_id` text NOT NULL,
	`api_key_id` text,
	`created_by` text,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`input_sha256` text NOT NULL,
	`error_json` text,
	`pdf_key` text,
	`bytes` integer,
	`pages` integer,
	`queued_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`duration_ms` integer,
	`pdf_expires_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`template_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`template_version_id`) REFERENCES `template_version`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generation_status_queued_idx` ON `generation` (`status`,`queued_at`);--> statement-breakpoint
CREATE INDEX `generation_project_idx` ON `generation` (`project_id`,`queued_at`);