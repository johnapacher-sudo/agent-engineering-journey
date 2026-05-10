import { and, eq } from 'drizzle-orm';
import { db } from '../';
import { usersTable, postsTable, tagsTable, tipsTable, postsTagsTable, SelectUser, SelectPost, SelectTag, SelectTip, SelectPostsTags } from '../schema';

export async function updateUser(id: SelectUser['id'], data: Partial<Omit<SelectUser, 'id'>>) {
  return await db.update(usersTable).set(data).where(eq(usersTable.id, id));
}

export async function updatePost(id: SelectPost['id'], data: Partial<Omit<SelectPost, 'id'>>) {
  return await db.update(postsTable).set(data).where(eq(postsTable.id, id));
}

export async function updateTag(id: SelectTag['id'], data: Partial<Omit<SelectTag, 'id'>>) {
 return  await db.update(tagsTable).set(data).where(eq(tagsTable.id, id)); 
}

export async function updateTip(id: SelectTip['id'], data: Partial<Omit<SelectTip, 'id'>>) {
  return await db.update(tipsTable).set(data).where(eq(tipsTable.id, id));
}

export async function updatePostsTags(postId: SelectPostsTags['postId'], tagId: SelectPostsTags['tagId'], data: Partial<Omit<SelectPostsTags, 'postId' | 'tagId'>>) {
  return await db.update(postsTagsTable).set(data).where(and(eq(postsTagsTable.postId, postId), eq(postsTagsTable.tagId, tagId)));
}