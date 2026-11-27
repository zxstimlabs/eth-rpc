CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"leased" bigint DEFAULT 0 NOT NULL,
	"lease_epoch" text,
	CONSTRAINT "accounts_balance_nonnegative" CHECK ("accounts"."balance" >= 0),
	CONSTRAINT "accounts_leased_nonnegative" CHECK ("accounts"."leased" >= 0)
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_state" (
	"chain_id" integer PRIMARY KEY NOT NULL,
	"last_block" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"chain_id" integer NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"memo" text NOT NULL,
	"token" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"credits" bigint NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "payments_chain_id_tx_hash_log_index_pk" PRIMARY KEY("chain_id","tx_hash","log_index"),
	CONSTRAINT "payments_credits_nonnegative" CHECK ("payments"."credits" >= 0)
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_account_id_idx" ON "api_keys" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "payments_memo_idx" ON "payments" USING btree ("memo");