CREATE TABLE "posts_table_5" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_table_5_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"content" text NOT NULL,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts_table_5" ADD CONSTRAINT "posts_table_5_user_id_users_table_5_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_table_5"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_table_5_user_id_index" ON "posts_table_5" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_table_5_created_at_index" ON "posts_table_5" USING btree ("created_at");