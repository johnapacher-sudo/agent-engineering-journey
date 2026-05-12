import { eq } from 'drizzle-orm';
import { db } from '../index';
import { postsTable, usersTable } from '../schema';

export const getUsers = async () => {
  return db.query.usersTable.findMany();
}

export const getPosts = async () => {
  return db.query.postsTable.findMany();
}

export const getUserById = async (id: number) => {
  return db.query.usersTable.findFirst({
    where: eq(usersTable.id, id),
  });
}

export const getPostById = async (id: number) => {
  return db.query.postsTable.findFirst({
    where: eq(postsTable.id, id),
  });
}

export const getUserWithPosts = async () => {
  return db.query.usersTable.findFirst({
    with: {
      posts: true,
    },
  });
}