import { eq } from 'drizzle-orm';
import { db } from '../index';
import { postsTable, SelectPost, SelectUser, usersTable } from '../schema';
export async function deleteUser(id: SelectUser['id']) {
  await db.delete(usersTable).where(eq(usersTable.id, id));
}
export async function deletePost(id: SelectPost['id']) {
  await db.delete(postsTable).where(eq(postsTable.id, id));
}