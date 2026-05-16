import { eq } from 'drizzle-orm';
import { db } from '../index';
import { postsTable, SelectPost, SelectTag, SelectUser, tagsTable, usersTable } from '../schema';

export const updateUser = async (id: number, data: Partial<Omit<SelectUser, 'id'>>) => {
  await db.update(usersTable).set(data).where(eq(usersTable.id, id));
}

export const updatePost = async (id: number, data: Partial<Omit<SelectPost, 'id'>>) => {
  await db.update(postsTable).set(data).where(eq(postsTable.id, id));
}

export const updateTag = async (id: number, data: Partial<Omit<SelectTag, 'id'>>) => {
  await db.update(tagsTable).set(data).where(eq(tagsTable.id, id));
}