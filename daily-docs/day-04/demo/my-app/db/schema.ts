import { relations } from "drizzle-orm";
import { index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable('users_table_3', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userName: text('user_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}) 

export const postsTable = pgTable('posts_table_3', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('name').notNull(),
  content: text('content').notNull(),
  status: text('status').$type<'draft' | 'published' | 'archived'>().notNull().default('draft'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  userId: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
}, (table) => [index('idx_posts_user_id').on(table.userId)]) 

export const tagsTable = pgTable('tags_table_3', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});


export const postsTagsTable = pgTable('posts_tags_table_3', {
  postId: integer('post_id').notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tagsTable.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.postId, table.tagId]}),
  index('idx_posts_tags_tag_id').on(table.tagId)
]);


export const userRelations = relations(usersTable, ({ many }) => ({
  posts: many(postsTable),
}));

export const postRelations = relations(postsTable, ({ one, many }) => ({
  user: one(usersTable, { fields: [postsTable.userId], references: [usersTable.id] }),
  tagsGroup: many(postsTagsTable),
}));

export const tagRelations = relations(tagsTable, ({ one, many }) => ({
  postsGroup: many(postsTagsTable),
}));

export const postsTagsRelations = relations(postsTagsTable, ({ one }) => ({
  post: one(postsTable, { fields: [postsTagsTable.postId], references: [postsTable.id] }),
  tag: one(tagsTable, { fields: [postsTagsTable.tagId], references: [tagsTable.id] }),
}));

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;
export type SelectPost = typeof postsTable.$inferSelect;
export type InsertTag = typeof tagsTable.$inferInsert;
export type SelectTag = typeof tagsTable.$inferSelect;
export type InsertPostsTags = typeof postsTagsTable.$inferInsert;
export type SelectPostsTags = typeof postsTagsTable.$inferSelect;
export type PostStatus = NonNullable<SelectPost['status']>;
