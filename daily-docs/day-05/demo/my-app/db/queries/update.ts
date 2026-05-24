import { eq } from "drizzle-orm";
import { db } from "../index";
import { SelectUser, usersTable } from "../schema";

export const updateUser = async (id: number, data: Partial<Omit<SelectUser, 'id' | 'createdAt' | 'updatedAt'>>) => {
    await db.update(usersTable).set(data).where(eq(usersTable.id, id));
}