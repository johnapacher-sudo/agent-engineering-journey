'use server';
import { getUserPostsAndTags, getAllUsersPostsAndTags, IPostsAndTagsRequest, getUsersInfoWithFilter, getUsersInfoWithFilter2 } from "@/db/queries/select";
import { SelectUser } from "@/db/schema";

export const getUserList = async ({ postTagName, postStatus }: IPostsAndTagsRequest) => {
  const postsAndTags = await getAllUsersPostsAndTags({ postTagName, postStatus });
  return postsAndTags;
}

export const getUsersInfo = async (params: IPostsAndTagsRequest) => {
  const users = await getUsersInfoWithFilter2(params);
  return users;
}