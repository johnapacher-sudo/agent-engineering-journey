"use server";

import postgres from 'postgres';
export async function getData() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  const response = await sql`SELECT version()`;
  return response[0].version;
}

export async function create(comment: string) {
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    await sql`CREATE TABLE IF NOT EXISTS comments (comment TEXT)`;
    // const comment = formData.get("comment");
    await sql`INSERT INTO comments (comment) VALUES (${comment})`;
}