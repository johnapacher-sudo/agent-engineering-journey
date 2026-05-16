'use server';
import { revalidatePath } from "next/cache";

import { updateUser } from "@/db/queries/update";
import { SelectUser } from "@/db/schema";

export const handleUpdateUser = async (
  id: number,
  data: Partial<Omit<SelectUser, 'id'>>,
) => {
  await updateUser(id, data);
  revalidatePath('/crud');
  revalidatePath(`/crud/user/${id}/edit`);
};
