"use server";

import { revalidatePath } from "next/cache";
import {
  batchCreateUserWithPostsAndTags,
  type InsertUserWithPostsAndTags,
} from "@/db/queries/insert";

type ActionResult =
  | {
      success: true;
      message: string;
      summary: {
        users: number;
        posts: number;
        tags: number;
        postsTags: number;
      };
    }
  | {
      success: false;
      error: string;
    };

const MAX_USERS = 10;
const MAX_POSTS_PER_USER = 10;
const MAX_TAGS_PER_POST = 10;

class ValidationError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const readString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
};

const assertRequired = (value: string, fieldName: string) => {
  if (!value) {
    throw new ValidationError(`${fieldName} 不能为空`);
  }
};

const parseUsers = (input: unknown): InsertUserWithPostsAndTags[] => {
  if (!isRecord(input) || !Array.isArray(input.users)) {
    throw new ValidationError("请求数据格式不正确");
  }

  if (input.users.length <= 0) {
    throw new ValidationError("请至少添加一个用户");
  }

  if (input.users.length > MAX_USERS) {
    throw new ValidationError(`一次最多创建 ${MAX_USERS} 个用户`);
  }

  const users = input.users.map((userInput, userIndex) => {
    if (!isRecord(userInput)) {
      throw new ValidationError(`第 ${userIndex + 1} 个用户格式不正确`);
    }

    const userName = readString(userInput, "userName");
    const email = readString(userInput, "email");
    const password = readString(userInput, "password");

    assertRequired(userName, `第 ${userIndex + 1} 个用户名称`);
    assertRequired(email, `第 ${userIndex + 1} 个用户邮箱`);
    assertRequired(password, `第 ${userIndex + 1} 个用户密码`);

    if (!email.includes("@")) {
      throw new ValidationError(`第 ${userIndex + 1} 个用户邮箱格式不正确`);
    }

    const rawPosts = Array.isArray(userInput.posts) ? userInput.posts : [];
    if (rawPosts.length > MAX_POSTS_PER_USER) {
      throw new ValidationError(`每个用户最多创建 ${MAX_POSTS_PER_USER} 篇文章`);
    }

    const posts = rawPosts.map((postInput, postIndex) => {
      if (!isRecord(postInput)) {
        throw new ValidationError(`第 ${userIndex + 1} 个用户的第 ${postIndex + 1} 篇文章格式不正确`);
      }

      const title = readString(postInput, "title");
      const content = readString(postInput, "content");

      assertRequired(title, `第 ${userIndex + 1} 个用户的第 ${postIndex + 1} 篇文章标题`);
      assertRequired(content, `第 ${userIndex + 1} 个用户的第 ${postIndex + 1} 篇文章内容`);

      const rawTags = Array.isArray(postInput.tags) ? postInput.tags : [];
      if (rawTags.length > MAX_TAGS_PER_POST) {
        throw new ValidationError(`每篇文章最多创建 ${MAX_TAGS_PER_POST} 个标签`);
      }

      const tags = Array.from(
        new Map(
          rawTags
            .map((tagInput) => (isRecord(tagInput) ? readString(tagInput, "name") : ""))
            .filter(Boolean)
            .map((name) => [name, { name }])
        ).values()
      );

      return {
        title,
        content,
        tags,
      };
    });

    return {
      userName,
      email,
      password,
      posts,
    };
  });

  const uniqueEmails = new Set(users.map((user) => user.email));
  if (uniqueEmails.size !== users.length) {
    throw new ValidationError("用户列表中存在重复邮箱");
  }

  return users;
};

export async function createUsersWithPostsAndTagsAction(input: unknown): Promise<ActionResult> {
  try {
    const users = parseUsers(input);
    const result = await batchCreateUserWithPostsAndTags(users);

    revalidatePath("/user/list");

    return {
      success: true,
      message: "批量创建成功",
      summary: {
        users: result.users.length,
        posts: result.posts.length,
        tags: result.tags.length,
        postsTags: result.postsTags.length,
      },
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
      };
    }

    console.error("Failed to batch create users:", error);

    return {
      success: false,
      error: "批量创建失败，请检查邮箱是否已存在后重试",
    };
  }
}
