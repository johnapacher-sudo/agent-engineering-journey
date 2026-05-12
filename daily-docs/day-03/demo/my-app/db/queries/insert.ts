import {db} from  '../index'
import { InsertPost, InsertUser, postsTable, usersTable } from '../schema';

export const createUser = async (data: InsertUser) => {
  const [user] = await db.insert(usersTable).values(data).returning();
  return user
}


export const createPost = async (data: InsertPost) => {
  const [post] = await db.insert(postsTable).values(data).returning();
  return post
}