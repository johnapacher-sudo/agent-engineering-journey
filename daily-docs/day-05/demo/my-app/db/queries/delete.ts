import { eq } from "drizzle-orm";
import {db}from "../index";
import { usersTable } from "../schema";

export const deleteUser = async (id: number) => {
    await db.delete(usersTable).where(eq(usersTable.id, id));
}