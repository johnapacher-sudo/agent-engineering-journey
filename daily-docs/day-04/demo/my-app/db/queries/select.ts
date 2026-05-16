import { and, countDistinct, eq, gt, inArray, SQL } from "drizzle-orm";
import { db } from "../index";
import {
  postsTable,
  usersTable,
  SelectUser,
  SelectPost,
  tagsTable,
  postsTagsTable,
  SelectPostsTags,
  InsertPostsTags,
  SelectTag,
} from "../schema";

export const getUsers = async () => {
  return db.query.usersTable.findMany();
};

export const getPosts = async () => {
  return db.query.postsTable.findMany();
};

export const getTags = async () => {
  return db.query.tagsTable.findMany();
};

export const getUserById = async (id: number) => {
  return db.query.usersTable.findFirst({
    where: eq(usersTable.id, id),
  });
};

export const getPostById = async (id: number) => {
  return db.query.postsTable.findFirst({
    where: eq(postsTable.id, id),
  });
};

export const getUserWithPosts = async () => {
  return db.query.usersTable.findFirst({
    with: {
      posts: true,
    },
  });
};

export interface IPostsAndTagsRequest {
  postTagName?: string;
  postStatus?: "draft" | "published" | "archived";
  postTagId?: SelectTag["id"];
  userId?: SelectUser["id"];
  postId?: SelectPost["id"];
  limit?: number;
  offset?: number;
  cursor?: number;
}

export interface IUserPostsAndTagsRequest extends IPostsAndTagsRequest {
  userId: SelectUser["id"];
}

export const getUserPostsAndTags = async ({
  userId,
  postTagName,
  postStatus,
}: IUserPostsAndTagsRequest) => {
  return db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
    with: {
      posts: {
        with: {
          tagsGroup: {
            with: {
              tag: true,
            },
            where: postTagName ? eq(tagsTable.name, postTagName) : undefined,
          },
        },
        where: postStatus ? eq(postsTable.status, postStatus) : undefined,
      },
    },
  });
};

export const getAllUsersPostsAndTags = async ({
  postTagId,
  postStatus,
}: IPostsAndTagsRequest) => {
  return db.query.usersTable.findMany({
    with: {
      posts: {
        with: {
          tagsGroup: {
            with: {
              tag: true,
            },
          },
        },
        where: postStatus ? eq(postsTable.status, postStatus) : undefined,
      },
    },
  });
};

type FilterHandler<T> = (v: NonNullable<T>) => SQL | undefined;

type FilterMap<T> = {
  [K in keyof T]?: FilterHandler<T[K]>;
};

const USER_SEARCH_FILTERS: FilterMap<IPostsAndTagsRequest> = {
  postTagId: (v: SelectTag["id"]) => eq(tagsTable.id, v),
  postStatus: (v: SelectPost["status"]) => eq(postsTable.status, v),
  postTagName: (v: SelectTag["name"]) => eq(tagsTable.name, v),
  userId: (v: SelectUser["id"]) => eq(usersTable.id, v),
  postId: (v: SelectPost["id"]) => eq(postsTable.id, v),
};

const buildWhere = <T extends Record<string, any>>(
  params: T,
  filters: FilterMap<T>,
) => {
  const conditions: SQL<unknown>[] = [];
  Object.entries(params).forEach(([key, value]) => {
    const filter = filters[key];
    if (!filter || value === undefined || value === null || value === "")
      return;
    const cond = filter(value);
    if (cond) conditions.push(cond);
  });
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
};

export const getUsersInfoWithFilter = async (params: IPostsAndTagsRequest) => {
  const users = await db
    .select()
    .from(usersTable)
    .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
    .leftJoin(postsTagsTable, eq(postsTable.id, postsTagsTable.postId))
    .leftJoin(tagsTable, eq(postsTagsTable.tagId, tagsTable.id))
    .where(buildWhere<IPostsAndTagsRequest>(params, USER_SEARCH_FILTERS));
  return users;
};

const USER_SEARCH_FILTERS_2: FilterMap<IPostsAndTagsRequest> = {
  userId: (v) => eq(usersTable.id, v),
  postId: (v) =>
    inArray(
      usersTable.id,
      db
        .select({ id: postsTable.userId })
        .from(postsTable)
        .where(eq(postsTable.id, v)),
    ),
  postTagId: (v) =>
    inArray(
      usersTable.id,
      db
        .select({ id: postsTable.userId })
        .from(postsTable)
        .innerJoin(postsTagsTable, eq(postsTagsTable.postId, postsTable.id))
        .innerJoin(tagsTable, eq(postsTagsTable.tagId, tagsTable.id))
        .where(eq(tagsTable.id, v)),
    ),
  postStatus: (v) =>
    inArray(
      usersTable.id,
      db
        .select({ id: postsTable.userId })
        .from(postsTable)
        .where(eq(postsTable.status, v)),
    ),
  postTagName: (v) =>
    inArray(
      usersTable.id,
      db
        .select({ id: postsTable.userId })
        .from(postsTable)
        .innerJoin(postsTagsTable, eq(postsTagsTable.postId, postsTable.id))
        .innerJoin(tagsTable, eq(postsTagsTable.tagId, tagsTable.id))
        .where(eq(tagsTable.name, v)),
    ),
};

const buildUserWhere = (params: IPostsAndTagsRequest) => {
  const conditions: SQL<unknown>[] = [];
  if(params.cursor) {
    conditions.push(gt(usersTable.id, params.cursor));
  }
  if (params.userId) {
    conditions.push(eq(usersTable.id, params.userId));
  }

  const postConditions: SQL<unknown>[] = [];
  if (params.postId) {
    postConditions.push(eq(postsTable.id, params.postId));
  }
  if (params.postStatus) {
    postConditions.push(eq(postsTable.status, params.postStatus));
  }

  if (params.postTagName) {
    postConditions.push(eq(tagsTable.name, params.postTagName));
  }
  if (params.postTagId) {
    postConditions.push(eq(postsTagsTable.tagId, params.postTagId));
  }
  const needsTagJoin = params.postTagId || params.postTagName;
  if (postConditions.length > 0) {
    const postSubQuery = db
      .select({ id: postsTable.userId })
      .from(postsTable)
      .$dynamic();

    if (needsTagJoin) {
      postSubQuery
        .innerJoin(postsTagsTable, eq(postsTagsTable.postId, postsTable.id))
        .innerJoin(tagsTable, eq(tagsTable.id, postsTagsTable.tagId));
    }
    conditions.push(
      inArray(usersTable.id, postSubQuery.where(and(...postConditions))),
    );
  }
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
};
const DEFAULT_LIMIT = 6;
const DEFAULT_OFFSET = 0;

export const getUsersInfoWithFilter2 = async (params: IPostsAndTagsRequest) => {
  const where = buildUserWhere(params);
  const offset = params.offset ?? DEFAULT_OFFSET;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const usersQueryPromise = db.query.usersTable.findMany({
    // where: buildWhere<IPostsAndTagsRequest>(params, USER_SEARCH_FILTERS_2),
    where: where,
    limit: limit,
    offset: offset,
    orderBy: (u, { asc }) => asc(u.id),
    with: {
      posts: {
        with: {
          tagsGroup: {
            with: {
              tag: true,
            },
          },
        },
      },
    },
  });

  const usersTotalPromise = db
  .select({ total: countDistinct(usersTable.id) })
  .from(usersTable)
  .where(where);

  const [users, usersTotal] = await Promise.all([usersQueryPromise, usersTotalPromise]);
  const total = usersTotal[0]?.total ?? 0;
  return {
    users,
    total,
    pageIndex: Math.floor(offset / limit) + 1,
    pageSize: limit,
    // 修正：offset + 当前页条数 < total 才有下一页（之前 > 写反了）
    hasNextPage: offset + users.length < total,
    hasPreviousPage: offset > 0,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    // 空数组兜底，避免 users[-1].id 抛错
    cursorIndex: users.length > 0 ? users[users.length - 1].id : null,
  };
};
