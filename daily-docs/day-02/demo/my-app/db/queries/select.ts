import { and, eq } from 'drizzle-orm';
import { db } from '../';
import { usersTable, postsTable, tagsTable, tipsTable, postsTagsTable, SelectUser, SelectPost, SelectTag, SelectTip, SelectPostsTags } from '../schema';

export async function getUserById(id: SelectUser['id']) {
  return db.select().from(usersTable).where(eq(usersTable.id, id));
}

export async function getPostById(id: SelectPost['id']) {
  return db.select().from(postsTable).where(eq(postsTable.id, id));
}

export async function getTagById(id: SelectTag['id']) {
  return db.select().from(tagsTable).where(eq(tagsTable.id, id));
}

export async function getTipById(id: SelectTip['id']) {
  return db.select().from(tipsTable).where(eq(tipsTable.id, id));
}

export async function getPostsTagsByPostId(postId: SelectPostsTags['postId']) {
  return db.select().from(postsTagsTable).where(eq(postsTagsTable.postId, postId));
}

export async function getPostsTagsByTagId(tagId: SelectPostsTags['tagId']) {
  return db.select().from(postsTagsTable).where(eq(postsTagsTable.tagId, tagId));
}

export async function getPostsTagsByPostIdAndTagId(postId: SelectPostsTags['postId'], tagId: SelectPostsTags['tagId']) {
  return db.select().from(postsTagsTable).where(and(eq(postsTagsTable.postId, postId), eq(postsTagsTable.tagId, tagId)));
}


export async function getUserWithPosts(id: SelectUser['id']) {
    return db.query.usersTable.findFirst({
        where: eq(usersTable.id, id),
        columns: {
            id: true,
            email: true,
        },
        with: {
            posts: {
                with: {
                    tagGroups: {
                        with: {
                            tag: true,
                        },
                    },
                },
            },
        },
    });
}