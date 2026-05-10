CREATE TABLE "posts_tags1_table" (
	"post_id" integer,
	"tag_id" integer,
	CONSTRAINT "posts_tags1_table_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "tags1_table" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "posts_tags1_table" ADD CONSTRAINT "posts_tags1_table_post_id_posts1_table_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts1_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_tags1_table" ADD CONSTRAINT "posts_tags1_table_tag_id_tags1_table_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags1_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags1_table" ADD CONSTRAINT "tags1_table_user_id_users1_table_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users1_table"("id") ON DELETE cascade ON UPDATE no action;