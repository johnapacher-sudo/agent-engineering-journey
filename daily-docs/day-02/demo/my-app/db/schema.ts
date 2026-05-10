import { index, primaryKey } from 'drizzle-orm/pg-core';
import {relations} from "drizzle-orm"
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users1_table', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  age: integer('age').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const postsTable = pgTable('posts1_table', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
}, (table) => [index('posts1_table_user_id_idx').on(table.userId)]);

export const tagsTable = pgTable('tags1_table', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  content: text('content').notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
}, (table) => [index('tags1_table_user_id_idx').on(table.userId)]);

export const tipsTable = pgTable('tips1_table', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  content: text('content').notNull(),
  tagId: integer('tag_id').notNull().references(() => tagsTable.id, { onDelete: 'cascade' }),
}, (table) => {
  return [index('tips1_table_tag_id_idx').on(table.tagId)]
});

export const postsTagsTable = pgTable('posts_tags1_table', {
  postId: integer('post_id').notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tagsTable.id, { onDelete: 'cascade' }),
}, (table) => [primaryKey({ columns: [table.postId, table.tagId] }), index('posts_tags1_table_tag_id_idx').on(table.tagId)]);


export const userRelations = relations(usersTable, ({ many }) => {
  return {
    posts: many(postsTable),
    tags: many(tagsTable)
  }
})

export const postsRelation = relations(postsTable, ({one, many}) => {
  return {
    author: one(usersTable, {
      fields: [postsTable.userId],
      references: [usersTable.id]
    }),
    tagGroups: many(postsTagsTable)
  }
})

export const tagsRelation = relations(tagsTable, ({one, many}) => {
  return {
    author: one(usersTable, {
      fields: [tagsTable.userId],
      references: [usersTable.id]
    }),
    postGroups: many(postsTagsTable),
    tips: many(tipsTable)
  }
})

export const postTagsRelation = relations(postsTagsTable, ({one}) => {
  return {
    post: one(postsTable, {
      fields: [postsTagsTable.postId],
      references: [postsTable.id]
    }),
    tag: one(tagsTable, {
      fields: [postsTagsTable.tagId],
      references: [tagsTable.id]
    }),
  }
})

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;
export type SelectPost = typeof postsTable.$inferSelect;
export type InsertTag = typeof tagsTable.$inferInsert;
export type SelectTag = typeof tagsTable.$inferSelect;
export type InsertTip = typeof tipsTable.$inferInsert;
export type SelectTip = typeof tipsTable.$inferSelect;
export type SelectPostsTags = typeof postsTagsTable.$inferSelect;
export type InsertPostsTags = typeof postsTagsTable.$inferInsert;