import { relations } from "drizzle-orm";
import { index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable('users_table_5', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userName: text('user_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('users_table_5_user_name_index').on(t.userName),
  index('users_table_5_email_index').on(t.email),
  index('users_table_5_created_at_index').on(t.createdAt),
]);


export const postsTable = pgTable('posts_table_5', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  userId: integer('user_id').references(() => usersTable.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
    index('posts_table_5_user_id_index').on(t.userId),
    index('posts_table_5_created_at_index').on(t.createdAt),
]);


export const tagsTable = pgTable('tags_table_5', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
   index('tags_table_5_name_index').on(t.name),
   index('tags_table_5_created_at_index').on(t.createdAt),
]);

export const postsTagsTable = pgTable('posts_tags_table_5', {
    postId: integer('post_id').references(() => postsTable.id),
    tagId: integer('tag_id').references(() => tagsTable.id),
}, (t) => [
    primaryKey({columns: [t.postId, t.tagId]}),
    index('posts_tags_table_5_tag_id_index').on(t.tagId),
]);




export const usersRelation = relations(usersTable, ({many}) => {
    return {
        posts: many(postsTable),
    }
})


export const postsRelation = relations(postsTable, ({one, many}) => {
    return {
        author: one(usersTable, {
            fields: [postsTable.userId],
            references: [usersTable.id],
        }),
        tagGroups: many(postsTagsTable),
    }
})

export const tagsRelation = relations(tagsTable, ({many}) => {
    return {
        postGroups: many(postsTagsTable),
    }
})

export const postsTagsRelation = relations(postsTagsTable, ({one}) => {
    return {
        post: one(postsTable, {
            fields: [postsTagsTable.postId],
            references: [postsTable.id],
        }),
        tag: one(tagsTable, {
            fields: [postsTagsTable.tagId],
            references: [tagsTable.id],
        }),
    }
})

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;
export type SelectPost = typeof postsTable.$inferSelect;
export type InsertTag = typeof tagsTable.$inferInsert;
export type SelectTag = typeof tagsTable.$inferSelect;
export type InsertPostsTags = typeof postsTagsTable.$inferInsert;
export type SelectPostsTags = typeof postsTagsTable.$inferSelect;
