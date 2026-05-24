import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "../index";
import { postsTable, postsTagsTable, usersTable } from "../schema";

export const getUsers = async () => {
  return await db.select({
    id: usersTable.id,
    userName: usersTable.userName,
    email: usersTable.email,
  }).from(usersTable);
};

export const getUserById = async (id: number) => {
  return await db.select({
    id: usersTable.id,
    userName: usersTable.userName,
    email: usersTable.email,
  }).from(usersTable).where(eq(usersTable.id, id));
};

export const getUserWithPostsByUserId = async (id: number) => {
    const result = db.query.usersTable.findFirst({
        where: eq(usersTable.id, id),
        with: {
            posts: true,
        },
    })
    return result;
};

export interface IUserInfoFilter {
    userId?: number;
    postId?: number;
    tagId?: number;
}

const buildUserWhere = (data: IUserInfoFilter) => {
    const conditions: SQL[] = [];
    if(data.userId) {
        conditions.push(eq(usersTable.id, data.userId));
    }
    const postWhere = buildPostWhere(data);
    if(postWhere) {
        const query = db.select({id: postsTable.userId}).from(postsTable).where(postWhere);
        conditions.push(inArray(usersTable.id, query))
    }
    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
}

const buildPostWhere = (data: IUserInfoFilter) => {
    const conditions: SQL[] = [];
    if (data.postId) {
        conditions.push(eq(postsTable.id, data.postId));
    }
    if (data.tagId) {
        conditions.push(inArray(
            postsTable.id,
            db.select({id: postsTagsTable.postId})
                .from(postsTagsTable)
                .where(eq(postsTagsTable.tagId, data.tagId))
        ));
    }
    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
}

const buildTagGroupWhere = (data: IUserInfoFilter) => {
    if (!data.tagId) return undefined;
    return eq(postsTagsTable.tagId, data.tagId);
}

export const getUserInfo = async (data: IUserInfoFilter) => {
    const where = buildUserWhere(data);
    const postWhere = buildPostWhere(data);
    const tagGroupWhere = buildTagGroupWhere(data);
    const result = await db.query.usersTable.findMany({
        where: where,
        columns: {
            password: false,
        },
        with: {
            posts: {
                where: postWhere,
                with: {
                   tagGroups: {
                        where: tagGroupWhere,
                        with: {
                            tag: true
                        }
                   }
                },
            },
        }
    })
    return result
}