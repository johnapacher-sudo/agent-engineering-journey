import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable('users_table_2', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userName: text('user_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}) 

export const postsTable = pgTable('posts_table_2', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  userId: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
}) 


export const userRelations = relations(usersTable, ({ many }) => ({
  posts: many(postsTable),
}))

export const postRelations = relations(postsTable, ({ one }) => ({
  user: one(usersTable, { fields: [postsTable.userId], references: [usersTable.id] }),
}))

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;
export type SelectPost = typeof postsTable.$inferSelect;
