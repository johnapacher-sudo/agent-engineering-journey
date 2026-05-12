'use server';

import { revalidatePath } from 'next/cache';

import {
  createUser as createUserQuery,
  createPost as createPostQuery,
  createTag as createTagQuery,
  createTip as createTipQuery,
  createPostsTags as createPostsTagsQuery,
} from '@/db/queries/insert';
import {
  updateUser as updateUserQuery,
  updatePost as updatePostQuery,
  updateTag as updateTagQuery,
  updateTip as updateTipQuery,
} from '@/db/queries/update';
import {
  deleteUser as deleteUserQuery,
  deletePost as deletePostQuery,
  deleteTag as deleteTagQuery,
  deleteTip as deleteTipQuery,
  deletePostsTags as deletePostsTagsQuery,
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
  await createUserQuery({ name, age, email });
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
  await updateUserQuery(id, data);
  revalidatePath(REVALIDATE_PATH);
}

export async function deleteUserAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  await deleteUserQuery(id);
  revalidatePath(REVALIDATE_PATH);
}

export async function createPostAction(formData: FormData) {
  const title = readStr(formData, 'title');
  const content = readStr(formData, 'content');
  const userId = readNum(formData, 'userId');
  if (!title || !content || userId === undefined) return;
  await createPostQuery({ title, content, userId });
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
  await updatePostQuery(id, data);
  revalidatePath(REVALIDATE_PATH);
}

export async function deletePostAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  await deletePostQuery(id);
  revalidatePath(REVALIDATE_PATH);
}

export async function createTagAction(formData: FormData) {
  const content = readStr(formData, 'content');
  const userId = readNum(formData, 'userId');
  if (!content || userId === undefined) return;
  await createTagQuery({ content, userId });
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
  await updateTagQuery(id, data);
  revalidatePath(REVALIDATE_PATH);
}

export async function deleteTagAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  await deleteTagQuery(id);
  revalidatePath(REVALIDATE_PATH);
}

export async function createTipAction(formData: FormData) {
  const content = readStr(formData, 'content');
  const tagId = readNum(formData, 'tagId');
  if (!content || tagId === undefined) return;
  await createTipQuery({ content, tagId });
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
  await updateTipQuery(id, data);
  revalidatePath(REVALIDATE_PATH);
}

export async function deleteTipAction(formData: FormData) {
  const id = readNum(formData, 'id');
  if (id === undefined) return;
  await deleteTipQuery(id);
  revalidatePath(REVALIDATE_PATH);
}

export async function createPostsTagsAction(formData: FormData) {
  const postId = readNum(formData, 'postId');
  const tagId = readNum(formData, 'tagId');
  if (postId === undefined || tagId === undefined) return;
  await createPostsTagsQuery({ postId, tagId });
  revalidatePath(REVALIDATE_PATH);
}

export async function deletePostsTagsAction(formData: FormData) {
  const postId = readNum(formData, 'postId');
  const tagId = readNum(formData, 'tagId');
  if (postId === undefined || tagId === undefined) return;
  await deletePostsTagsQuery(postId, tagId);
  revalidatePath(REVALIDATE_PATH);
}

export type CreateUserInput = {
  name: string;
  age: number;
  email: string;
};

export type UpdateUserInput = {
  id: number;
  name?: string;
  age?: number;
  email?: string;
};

export type DeleteUserInput = {
  id: number;
};

export async function createUser(input: CreateUserInput) {
  if (!input.name?.trim()) throw new Error('name 不能为空');
  if (!input.email?.trim()) throw new Error('email 不能为空');
  if (!Number.isFinite(input.age)) throw new Error('age 必须是数字');
  await createUserQuery({
    name: input.name.trim(),
    age: input.age,
    email: input.email.trim(),
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function updateUser(input: UpdateUserInput) {
  if (!Number.isFinite(input.id)) throw new Error('id 必须是数字');
  const data: { name?: string; age?: number; email?: string } = {};
  if (input.name !== undefined && input.name.trim() !== '') {
    data.name = input.name.trim();
  }
  if (input.age !== undefined) {
    if (!Number.isFinite(input.age)) throw new Error('age 必须是数字');
    data.age = input.age;
  }
  if (input.email !== undefined && input.email.trim() !== '') {
    data.email = input.email.trim();
  }
  if (Object.keys(data).length === 0) throw new Error('至少填写一个要修改的字段');
  await updateUserQuery(input.id, data);
  revalidatePath(REVALIDATE_PATH);
}

export async function deleteUser(input: DeleteUserInput) {
  if (!Number.isFinite(input.id)) throw new Error('id 必须是数字');
  await deleteUserQuery(input.id);
  revalidatePath(REVALIDATE_PATH);
}
