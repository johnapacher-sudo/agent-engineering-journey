'use server';

import { revalidatePath } from 'next/cache';

import { createPost, createUser } from "@/db/queries/insert";
import { deletePost, deleteUser } from "@/db/queries/delete";
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

export const handleDeleteUser = async (id: number) => {
  await deleteUser(id);
  revalidatePath('/crud');
}

export const handleDeletePost = async (id: number) => {
  await deletePost(id);
  revalidatePath('/crud');
}

