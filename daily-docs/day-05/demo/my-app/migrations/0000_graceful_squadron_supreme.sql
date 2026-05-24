CREATE TABLE "users_table_5" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_table_5_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_table_5_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "users_table_5_user_name_index" ON "users_table_5" USING btree ("user_name");--> statement-breakpoint
CREATE INDEX "users_table_5_email_index" ON "users_table_5" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_table_5_created_at_index" ON "users_table_5" USING btree ("created_at");