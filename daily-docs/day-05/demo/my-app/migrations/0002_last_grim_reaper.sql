CREATE TABLE "posts_tags_table_5" (
	"post_id" integer,
	"tag_id" integer,
	CONSTRAINT "posts_tags_table_5_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags_table_5" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_table_5_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_table_5_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "posts_tags_table_5" ADD CONSTRAINT "posts_tags_table_5_post_id_posts_table_5_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts_table_5"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_tags_table_5" ADD CONSTRAINT "posts_tags_table_5_tag_id_tags_table_5_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags_table_5"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_tags_table_5_tag_id_index" ON "posts_tags_table_5" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tags_table_5_name_index" ON "tags_table_5" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tags_table_5_created_at_index" ON "tags_table_5" USING btree ("created_at");