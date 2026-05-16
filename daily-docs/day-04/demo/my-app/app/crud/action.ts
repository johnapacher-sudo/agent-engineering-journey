'use server';

import { revalidatePath } from 'next/cache';

import {
  createPost,
  createPostsTags,
  createTag,
  createUser,
} from "@/db/queries/insert";
import { deletePost, deleteTag, deleteUser } from "@/db/queries/delete";
import { InsertPost, InsertUser } from "@/db/schema";

export const handleAddUser = async (data: InsertUser) => {
  const user = await createUser(data);
  revalidatePath('/crud');
  return user;
}

export const handleAddPost = async (data: InsertPost) => {
  const post = await createPost(data);
  revalidatePath('/crud');
  return post;
}

export const handleAddTag = async ({
  name,
  postId,
}: {
  name: string;
  postId?: number;
}) => {
  const tag = await createTag({ name });
  if (postId !== undefined) {
    await createPostsTags({ postId, tagId: tag.id });
  }
  revalidatePath('/crud');
  revalidatePath('/crud/user/list');
  return tag;
}

export const handleDeleteUser = async (id: number) => {
  await deleteUser(id);
  revalidatePath('/crud');
}

export const handleDeletePost = async (id: number) => {
  await deletePost(id);
  revalidatePath('/crud');
}

export const handleDeleteTag = async (id: number) => {
  await deleteTag(id);
  revalidatePath('/crud');
  revalidatePath('/crud/user/list');
}

