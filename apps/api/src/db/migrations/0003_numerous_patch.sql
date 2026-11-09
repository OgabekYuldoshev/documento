CREATE TABLE `template` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`current_version_id` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_project_slug_uq` ON `template` (`project_id`,`slug`);--> statement-breakpoint
CREATE TABLE `template_version` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`number` integer NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`schema` text NOT NULL,
	`sample_data` text NOT NULL,
	`render_timeout_sec` integer DEFAULT 60 NOT NULL,
	`max_payload_kb` integer DEFAULT 1024 NOT NULL,
	`published_at` integer,
	`published_by` text,
	`checksum` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`published_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_version_number_uq` ON `template_version` (`template_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `template_version_one_draft_uq` ON `template_version` (`template_id`) WHERE "template_version"."status" = 'draft';--> statement-breakpoint
CREATE INDEX `template_version_template_idx` ON `template_version` (`template_id`);