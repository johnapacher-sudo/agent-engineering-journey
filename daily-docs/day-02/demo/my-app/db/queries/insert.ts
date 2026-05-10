import { db } from '../';
import { usersTable, postsTable, tagsTable, tipsTable, postsTagsTable, InsertUser, InsertPost, InsertTag, InsertPostsTags, InsertTip } from '../schema';

export async function createUser(data: InsertUser) {
  const [user] = await db.insert(usersTable).values(data).returning();
  return user
}

export async function createPost(data: InsertPost) {
  const [post] = await db.insert(postsTable).values(data).returning();
  return post
}

export async function createTag(data: InsertTag) {
  const [tag] = await db.insert(tagsTable).values(data).returning();
  return tag
}

export async function createTip(data: InsertTip) {
  const [tip] = await db.insert(tipsTable).values(data).returning();
  return tip
}

export async function createPostsTags(data: InsertPostsTags) {
  const [postsTags] = await db.insert(postsTagsTable).values(data).returning();
  return postsTags
}