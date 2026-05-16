'use server';

import { revalidatePath } from 'next/cache';
import { createUserWithPostsAndTags } from '@/db/queries/insert';

interface TagInput {
  name: string;
}

interface PostInput {
  title: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  tags: TagInput[];
}

interface UserInput {
  userName: string;
  email: string;
  password: string;
  posts: PostInput[];
}

export async function batchCreateUsers(users: UserInput[]) {
  if (!users || users.length === 0) {
    return { success: false, error: 'No users provided' };
  }

  const results = [];

  for (const userData of users) {
    if (!userData.userName || !userData.email || !userData.password) {
      return {
        success: false,
        error: `User "${userData.userName || 'unnamed'}" is missing required fields (userName, email, password)`,
      };
    }

    for (const post of userData.posts) {
      if (!post.title || !post.content) {
        return {
          success: false,
          error: `Post in user "${userData.userName}" is missing required fields (title, content)`,
        };
      }
    }

    // userId is set internally by createUserWithPostsAndTags
    const result = await createUserWithPostsAndTags(userData as Parameters<typeof createUserWithPostsAndTags>[0]);
    results.push(result);
  }

  revalidatePath('/crud/user/list');
  return { success: true, data: results };
}
