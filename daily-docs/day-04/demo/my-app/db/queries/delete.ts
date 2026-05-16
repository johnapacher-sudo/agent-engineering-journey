import { eq } from 'drizzle-orm';
import { db } from '../index';
import { postsTable, tagsTable, usersTable } from '../schema';

export const deleteUser = async (id: number) => {
  await db.delete(usersTable).where(eq(usersTable.id, id));
}

export const deletePost = async (id: number) => {
  await db.delete(postsTable).where(eq(postsTable.id, id));
}

export const deleteTag = async (id: number) => {
  await db.delete(tagsTable).where(eq(tagsTable.id, id));
}