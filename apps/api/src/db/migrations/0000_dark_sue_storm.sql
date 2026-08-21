CREATE TABLE `notifications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`submission_id` bigint unsigned NOT NULL,
	`recipient_email` varchar(255) NOT NULL,
	`previous_status` varchar(20),
	`new_status` varchar(20) NOT NULL,
	`message` text NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`company` varchar(160) NOT NULL,
	`job_title` varchar(160),
	`rating` tinyint unsigned NOT NULL,
	`testimonial_text` text NOT NULL,
	`type` varchar(20) NOT NULL,
	`source_link` varchar(2048),
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`submitted_at` datetime NOT NULL,
	`reviewed_at` datetime,
	`reviewed_by` varchar(20),
	`rejection_note` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_rating` CHECK(`submissions`.`rating` BETWEEN 1 AND 5),
	CONSTRAINT `chk_type` CHECK(`submissions`.`type` IN ('written','video','social','review')),
	CONSTRAINT `chk_status` CHECK(`submissions`.`status` IN ('pending','approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_submission` ON `notifications` (`submission_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_status_submitted` ON `submissions` (`status`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_status_rating` ON `submissions` (`status`,`rating`);--> statement-breakpoint
CREATE INDEX `idx_type` ON `submissions` (`type`);--> statement-breakpoint
CREATE INDEX `idx_submitted_at` ON `submissions` (`submitted_at`);