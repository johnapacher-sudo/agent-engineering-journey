import { eq } from 'drizzle-orm';
import { db } from '../index';
import { postsTable, SelectPost, SelectUser, usersTable } from '../schema';

export const updateUser = async (id: number, data: Partial<Omit<SelectUser, 'id'>>) => {
  await db.update(usersTable).set(data).where(eq(usersTable.id, id));
}

export const updatePost = async (id: number, data: Partial<Omit<SelectPost, 'id'>>) => {
  await db.update(postsTable).set(data).where(eq(postsTable.id, id));
}