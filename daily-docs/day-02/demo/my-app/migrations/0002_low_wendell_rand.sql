ALTER TABLE "posts_tags1_table" ALTER COLUMN "post_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts_tags1_table" ALTER COLUMN "tag_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tips1_table" ADD COLUMN "tag_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "tips1_table" ADD CONSTRAINT "tips1_table_tag_id_tags1_table_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags1_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts1_table_user_id_idx" ON "posts1_table" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_tags1_table_tag_id_idx" ON "posts_tags1_table" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tags1_table_user_id_idx" ON "tags1_table" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tips1_table_tag_id_idx" ON "tips1_table" USING btree ("tag_id");