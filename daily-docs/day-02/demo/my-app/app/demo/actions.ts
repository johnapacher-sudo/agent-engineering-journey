'use server';

import { revalidatePath } from 'next/cache';

import {
  createUser,
  createPost,
  createTag,
  createTip,
  createPostsTags,
} from '@/db/queries/insert';
import {
  updateUser,
  updatePost,
  updateTag,
  updateTip,
} from '@/db/queries/update';
import {
  deleteUser,
  deletePost,
  deleteTag,
  deleteTip,
  deletePostsTags,
} from '@/db/queries/delete';

const REVALIDATE_PATH = '/demo';

function readStr(fd: FormData, key: string): string | undefined {
  const raw = fd.get(key);
  if (raw == null) return undefined;
  const v = raw.toString().trim();
  return v === '' ? undefined : v;
}

function readNum(fd: FormData, key: string): number | undefined {
  const v = readStr(fd, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function createUserAction(formData: FormData) {
  const name = readStr(formData, 'name');
  const age = readNum(formData, 'age');
  const email = readStr(formData, 'email');
  if (!name || age === undefined || !email) return;
  await createUser({ name, age, email });
  revalidatePath(REVALIDATE_PATH);
}

export async function updateUserAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  const data: { name?: string; age?: number; email?: string } = {};
  const name = readStr(formData, 'name');
  const age = readNum(formData, 'age');
  const email = readStr(formData, 'email');
  if (name !== undefined) data.name = name;
  if (age !== undefined) data.age = age;
  if (email !== undefined) data.email = email;
  if (Object.keys(data).length === 0) return;
  await updateUser(id, data);
  revalidatePath(REVALIDATE_PATH);
}

export async function deleteUserAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  await deleteUser(id);
  revalidatePath(REVALIDATE_PATH);
}

export async function createPostAction(formData: FormData) {
  const title = readStr(formData, 'title');
  const content = readStr(formData, 'content');
  const userId = readNum(formData, 'userId');
  if (!title || !content || userId === undefined) return;
  await createPost({ title, content, userId });
  revalidatePath(REVALIDATE_PATH);
}

export async function updatePostAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  const data: { title?: string; content?: string; userId?: number } = {};
  const title = readStr(formData, 'title');
  const content = readStr(formData, 'content');
  const userId = readNum(formData, 'userId');
  if (title !== undefined) data.title = title;
  if (content !== undefined) data.content = content;
  if (userId !== undefined) data.userId = userId;
  if (Object.keys(data).length === 0) return;
  await updatePost(id, data);
  revalidatePath(REVALIDATE_PATH);
}

export async function deletePostAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  await deletePost(id);
  revalidatePath(REVALIDATE_PATH);
}

export async function createTagAction(formData: FormData) {
  const content = readStr(formData, 'content');
  const userId = readNum(formData, 'userId');
  if (!content || userId === undefined) return;
  await createTag({ content, userId });
  revalidatePath(REVALIDATE_PATH);
}

export async function updateTagAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  const data: { content?: string; userId?: number } = {};
  const content = readStr(formData, 'content');
  const userId = readNum(formData, 'userId');
  if (content !== undefined) data.content = content;
  if (userId !== undefined) data.userId = userId;
  if (Object.keys(data).length === 0) return;
  await updateTag(id, data);
  revalidatePath(REVALIDATE_PATH);
}

export async function deleteTagAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  await deleteTag(id);
  revalidatePath(REVALIDATE_PATH);
}

export async function createTipAction(formData: FormData) {
  const content = readStr(formData, 'content');
  const tagId = readNum(formData, 'tagId');
  if (!content || tagId === undefined) return;
  await createTip({ content, tagId });
  revalidatePath(REVALIDATE_PATH);
}

export async function updateTipAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  const data: { content?: string; tagId?: number } = {};
  const content = readStr(formData, 'content');
  const tagId = readNum(formData, 'tagId');
  if (content !== undefined) data.content = content;
  if (tagId !== undefined) data.tagId = tagId;
  if (Object.keys(data).length === 0) return;
  await updateTip(id, data);
  revalidatePath(REVALIDATE_PATH);
}

export async function deleteTipAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  await deleteTip(id);
  revalidatePath(REVALIDATE_PATH);
}

export async function createPostsTagsAction(formData: FormData) {
  const postId = readNum(formData, 'postId');
  const tagId = readNum(formData, 'tagId');
  if (postId === undefined || tagId === undefined) return;
  await createPostsTags({ postId, tagId });
  revalidatePath(REVALIDATE_PATH);
}

export async function deletePostsTagsAction(formData: FormData) {
  const postId = readNum(formData, 'postId');
  const tagId = readNum(formData, 'tagId');
  if (postId === undefined || tagId === undefined) return;
  await deletePostsTags(postId, tagId);
  revalidatePath(REVALIDATE_PATH);
}
