import { sql } from "drizzle-orm";
import { db } from "../index";

import { InsertPost, InsertPostsTags, InsertTag, InsertUser, postsTable, postsTagsTable, tagsTable, usersTable } from "../schema";

export const createUser = async (data: InsertUser) => {
    const [user] = await db.insert(usersTable).values(data).returning();
    return user;
}


export const batchCreateUsers = async (data: InsertUser[]) => {
    const users = await db.insert(usersTable).values(data).returning();
    return users;
}

export interface InsertPostWithTags extends InsertPost {
    tags?: InsertTag[]
}

export interface InsertUserWithPostsAndTags extends InsertUser {
    posts?: InsertPostWithTags[];
}
export const batchCreateUserWithPostsAndTags = async (data: InsertUserWithPostsAndTags[]) => {
   return await db.transaction(async (tx) => {
        const usersRequest = data.map(({ userName, email, password }) => ({
            userName,
            email,
            password,
        }));
        if (usersRequest.length <= 0) return {users: [], posts: [], tags: [], postsTags: []};
       const userList = await tx.insert(usersTable).values(usersRequest).returning();
       const postsRequest: InsertPostWithTags[] = [];
       const tagsRequest: InsertTag[] = [];
        userList.forEach((user) => {
            const posts = data.find((item) => item.email === user.email)?.posts;
            if (posts && posts.length > 0) {
                postsRequest.push(...posts.map((post) => {
                    const { tags = [], ...postData } = post;
                    return {
                        ...postData,
                        userId: user.id,
                        tags,
                    }
                }));
            }
        });
        if (postsRequest.length <= 0) return {users: userList, posts: [], tags: [], postsTags: []};
        const postsList =await tx.insert(postsTable).values(postsRequest).returning();
       postsList.forEach((_post, index) => {
            const postData = postsRequest[index];
            const tags = postData?.tags;
            if (tags && tags.length > 0) {
                tagsRequest.push(...tags);
            }
       })
       if(tagsRequest.length <= 0) return {users: userList, posts: postsList, tags: [], postsTags: []};
       const uniqueTagsRequest = Array.from(
        new Map(tagsRequest.map((tag) => [tag.name, tag])).values()
       );
       const tagsList = await tx.insert(tagsTable)
                                .values(uniqueTagsRequest)
                                .onConflictDoUpdate({target: tagsTable.name, set: {name: sql`excluded.name`}})
                                .returning();
       const InsertedTagMap = new Map(tagsList.map(tag => [tag.name, tag.id]));
       const postsTagsRequest = Array.from(new Map(postsList.flatMap((post, index) => {
        const currentTags = postsRequest[index]?.tags;
        return (currentTags ?? [])
            .map(tag => InsertedTagMap.get(tag.name))
            .filter(tagId => tagId !== undefined)
            .map(tagId => ({
                postId: post.id,
                tagId: tagId
            }))
       }).map((item) => [`${item.postId}-${item.tagId}`, item])).values()) satisfies InsertPostsTags[];
       if (postsTagsRequest.length <= 0) return {users: userList, posts: postsList, tags: tagsList, postsTags: []};
       const postsTagsList = await tx.insert(postsTagsTable).values(postsTagsRequest).returning();
       return {users: userList, posts: postsList, tags: tagsList, postsTags: postsTagsList};
   })
}

export const createPost = async (data: InsertPost) => {
    const [post] = await db.insert(postsTable).values(data).returning();
    return post;
}

export const createTag = async (data: InsertTag) => {
    const [tag] = await db.insert(tagsTable).values(data).returning();
    return tag;
}

export const createPostsTags = async (data: InsertPostsTags) => {
    const [postsTags] = await db.insert(postsTagsTable).values(data).returning();
    return postsTags;
}