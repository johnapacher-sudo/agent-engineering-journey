import { and, eq } from 'drizzle-orm';
import { db } from '../';
import { usersTable, postsTable, tagsTable, tipsTable, postsTagsTable, SelectUser, SelectPost, SelectTag, SelectTip, SelectPostsTags } from '../schema';

export async function deleteUser(id: SelectUser['id']) {
  return await db.delete(usersTable).where(eq(usersTable.id, id));
}

export async function deletePost(id: SelectPost['id']) {
  return await db.delete(postsTable).where(eq(postsTable.id, id));
}

export async function deleteTag(id: SelectTag['id']) {
  return await db.delete(tagsTable).where(eq(tagsTable.id, id));
}

export async function deleteTip(id: SelectTip['id']) {
  return await db.delete(tipsTable).where(eq(tipsTable.id, id));
}

export async function deletePostsTags(postId: SelectPostsTags['postId'], tagId: SelectPostsTags['tagId']) {
  return await db.delete(postsTagsTable).where(and(eq(postsTagsTable.postId, postId), eq(postsTagsTable.tagId, tagId)));
}