CREATE TABLE `coins` (
	`coingecko_id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`logo_uri` text,
	`um_curated` integer DEFAULT true NOT NULL,
	`description` text,
	`links` text,
	`categories` text,
	`sentiment_up` real,
	`sentiment_down` real,
	`community` text,
	`developer` text,
	`profile_updated_at` integer,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`chain_id` integer NOT NULL,
	`address` text NOT NULL,
	`coingecko_id` text NOT NULL,
	`decimals` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`chain_id`, `address`)
);
--> statement-breakpoint
CREATE INDEX `deployments_coingecko_id_idx` ON `deployments` (`coingecko_id`);--> statement-breakpoint
CREATE INDEX `deployments_chain_id_idx` ON `deployments` (`chain_id`);--> statement-breakpoint
CREATE TABLE `markets` (
	`coingecko_id` text PRIMARY KEY NOT NULL,
	`vs_currency` text DEFAULT 'usd' NOT NULL,
	`price` real,
	`market_cap` real,
	`market_cap_rank` integer,
	`fully_diluted_valuation` real,
	`total_volume` real,
	`high_24h` real,
	`low_24h` real,
	`price_change_24h` real,
	`price_change_percentage_24h` real,
	`price_change_percentage` text,
	`ath` real,
	`ath_change_percentage` real,
	`ath_date` text,
	`atl` real,
	`atl_change_percentage` real,
	`atl_date` text,
	`circulating_supply` real,
	`total_supply` real,
	`max_supply` real,
	`sparkline_7d` text,
	`last_updated` text,
	`raw` text,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
