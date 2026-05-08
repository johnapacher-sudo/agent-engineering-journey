"use server";

import { revalidatePath } from "next/cache";
import { createPost, createUser } from "@/db/queries/insert";
import { deletePost, deleteUser } from "@/db/queries/delete";
import {
  getPostsByUserId,
  getUsersWithPostsCount,
} from "@/db/queries/select";
import { updatePost, updateUser } from "@/db/queries/update";
import type {
  InsertPost,
  InsertUser,
  SelectPost,
  SelectUser,
} from "@/db/schema";

export async function listUsersAction() {
  return getUsersWithPostsCount(1, 50);
}

export async function createUserAction(data: InsertUser) {
  await createUser(data);
  revalidatePath("/drizzle");
}

export async function updateUserAction(
  id: SelectUser["id"],
  data: Partial<Omit<SelectUser, "id">>,
) {
  await updateUser(id, data);
  revalidatePath("/drizzle");
}

export async function deleteUserAction(id: SelectUser["id"]) {
  await deleteUser(id);
  revalidatePath("/drizzle");
}

export async function listPostsByUserAction(userId: SelectUser["id"]) {
  return getPostsByUserId(userId);
}

export async function createPostAction(data: InsertPost) {
  await createPost(data);
  revalidatePath("/drizzle");
}

export async function updatePostAction(
  id: SelectPost["id"],
  data: Partial<Omit<SelectPost, "id" | "userId" | "createdAt" | "updatedAt">>,
) {
  await updatePost(id, data);
  revalidatePath("/drizzle");
}

export async function deletePostAction(id: SelectPost["id"]) {
  await deletePost(id);
  revalidatePath("/drizzle");
}
