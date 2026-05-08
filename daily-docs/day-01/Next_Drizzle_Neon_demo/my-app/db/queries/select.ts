import { eq, getTableColumns, count, asc, desc, between, sql } from 'drizzle-orm';
import { db } from '../index';
import { SelectPost, SelectUser, postsTable, usersTable } from '../schema';
export async function getUserById(id: SelectUser['id']) {
  return db.select().from(usersTable).where(eq(usersTable.id, id));
}
export async function getPostById(id: SelectPost['id']) {
  return db.select().from(postsTable).where(eq(postsTable.id, id));
}
export async function getPostsByUserId(userId: SelectUser['id']) {
  return db
    .select()
    .from(postsTable)
    .where(eq(postsTable.userId, userId))
    .orderBy(desc(postsTable.createdAt));
}

export async function getUsersWithPostsCount(
    page = 1,
    pageSize = 5,
  ) {
    return db
      .select({
        ...getTableColumns(usersTable),
        postsCount: count(postsTable.id),
      })
      .from(usersTable)
      .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
      .groupBy(usersTable.id)
      .orderBy(asc(usersTable.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
}

export async function getPostsForLast24Hours(
    page = 1,
    pageSize = 5,
  ) {
    return db
      .select({
        id: postsTable.id,
        title: postsTable.title,
      })
      .from(postsTable)
      .where(between(postsTable.createdAt, sql`now() - interval '1 day'`, sql`now()`))
      .orderBy(asc(postsTable.title), asc(postsTable.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
  }