'use server';
import { updatePost } from "@/db/queries/update";
import { SelectPost, SelectUser } from "@/db/schema";
import { revalidatePath } from "next/cache";

export const handleUpdatePost = async (id: number, data: Partial<Omit<SelectPost, 'id'>>) => {
  await updatePost(id, data);
  revalidatePath('/crud');
  revalidatePath(`/crud/post/${id}/edit`);
}