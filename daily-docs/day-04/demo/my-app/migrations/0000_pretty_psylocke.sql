CREATE TABLE "posts_table_3" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_table_3_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts_tags_table_3" (
	"post_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "posts_tags_table_3_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags_table_3" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_table_3_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_table_3" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_table_3_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_table_3_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "posts_table_3" ADD CONSTRAINT "posts_table_3_user_id_users_table_3_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_table_3"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_tags_table_3" ADD CONSTRAINT "posts_tags_table_3_post_id_posts_table_3_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts_table_3"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_tags_table_3" ADD CONSTRAINT "posts_tags_table_3_tag_id_tags_table_3_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags_table_3"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_posts_user_id" ON "posts_table_3" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_posts_tags_tag_id" ON "posts_tags_table_3" USING btree ("tag_id");