import { eq } from 'drizzle-orm';
import { db } from '../index';
import { SelectPost, SelectUser, postsTable, usersTable } from '../schema';
export async function updateUser(id: SelectUser['id'], data: Partial<Omit<SelectUser, 'id'>>) {
  await db.update(usersTable).set(data).where(eq(usersTable.id, id));
}
export async function updatePost(id: number, data: Partial<Omit<SelectPost, 'id'>>) {
  await db.update(postsTable).set(data).where(eq(postsTable.id, id));
}