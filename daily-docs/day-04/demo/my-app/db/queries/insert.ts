import { sql } from 'drizzle-orm';
import {db} from  '../index'
import { InsertPost, InsertPostsTags, InsertTag, InsertUser, postsTable, postsTagsTable, tagsTable, usersTable } from '../schema';

export const createUser = async (data: InsertUser, tx?: any) => {
  const [user] = await (tx || db).insert(usersTable).values(data).returning();
  return user
} 


export const createPost = async (data: InsertPost, tx?: any) => {
  const [post] = await (tx || db).insert(postsTable).values(data).returning();
  return post
}

export const createTag = async (data: InsertTag, tx?: any) => {
  const [tag] = await (tx || db).insert(tagsTable).values(data).returning();
  return tag
}

export const createPostsTags = async (data: InsertPostsTags, tx?: any) => {
  const [postsTags] = await (tx || db).insert(postsTagsTable).values(data).returning();
  return postsTags
}


interface InsertPostWithTags extends InsertPost {
  tags: InsertTag[];
}
interface InsertUserWithPostsAndTags extends InsertUser {
  posts: InsertPostWithTags[];
}


export const createUserWithPostsAndTags = async (data: InsertUserWithPostsAndTags) => {
  return await db.transaction(async (tx) => {
    const { posts = [], ...user } = data;
    const userResult = await createUser(user, tx);
    const tagList:Set<InsertTag['name']> = new Set<InsertTag['name']>();
    const postTagsList: InsertTag[][] = [];
    const postList:InsertPost[] = posts.map((post, index) => {
      const { tags = [], ...postData } = post;
      tags.forEach(tag=> {
        tagList.add(tag.name);
      });
      postTagsList.push(tags)
      return {
        ...postData,
        userId: userResult.id,
      };
    });
    if (postList.length <= 0) return { user: userResult, posts: [], tags: [], postsTags: [] };
    // if(postList.length > 0) {
    //   throw new Error('postList is empty');
    // }
    const postListResult = await tx.insert(postsTable).values(postList).returning();


    if (tagList.size <= 0) return { user: userResult, posts: postListResult, tags: [], postsTags: [] }; 
    const tagsRequest:InsertTag[] = Array.from(tagList).map(name => ({ name }));
    const tagListResult = await tx.insert(tagsTable).values(tagsRequest).onConflictDoUpdate({ target: tagsTable.name, set: { name: sql`excluded.name` } }).returning();


    // const postListRequest:InsertPostsTags[] = [];
    const insertedTagMap = new Map(tagListResult.map(v => [v.name, v.id]));

    // postListResult.forEach((post, index) => {
    //   const currentTags = postTagsList[index];
    //   if (currentTags && currentTags.length > 0) {
    //     currentTags.forEach(tag => {
    //       const tagId = insertedTagMap.get(tag.name)
    //       if (tagId) {
    //         postListRequest.push({
    //           postId: post.id,
    //           tagId: tagId
    //         })
    //       }
    //     })
    //   }
    // })
    const postListRequest: InsertPostsTags[]  = postListResult.flatMap((post, index) => {
      return (postTagsList[index] ?? [])
              .map(tag => (insertedTagMap.get(tag.name)))
              .filter(tagId => tagId !== undefined)
              .map(tagId => ({
                postId: post.id,
                tagId: tagId
              }))
    })
    
    if (postListRequest.length <= 0) return { user: userResult, posts: postListResult, tags: tagListResult, postsTags: [] };
    const postTagListResult = await tx.insert(postsTagsTable).values(postListRequest).onConflictDoNothing().returning();
    return { user: userResult, posts: postListResult, tags: tagListResult, postsTags: postTagListResult };
  });
}

