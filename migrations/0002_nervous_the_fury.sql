CREATE TABLE `war_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text,
	`fetched_at` integer,
	`tried_at` integer NOT NULL,
	`ok` integer NOT NULL,
	`error` text
);
