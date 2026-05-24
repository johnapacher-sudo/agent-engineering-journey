"use client";

import { useState, useTransition } from "react";
import { createUsersWithPostsAndTagsAction } from "./actions";

type TagForm = {
  id: string;
  name: string;
};

type PostForm = {
  id: string;
  title: string;
  content: string;
  tags: TagForm[];
};

type UserForm = {
  id: string;
  userName: string;
  email: string;
  password: string;
  posts: PostForm[];
};

type ActionSummary = {
  users: number;
  posts: number;
  tags: number;
  postsTags: number;
};

type PageResult =
  | {
      success: true;
      message: string;
      summary: ActionSummary;
    }
  | {
      success: false;
      error: string;
    };

const createId = () => crypto.randomUUID();

const createEmptyTag = (): TagForm => ({
  id: createId(),
  name: "",
});

const createEmptyPost = (): PostForm => ({
  id: createId(),
  title: "",
  content: "",
  tags: [createEmptyTag()],
});

const createEmptyUser = (): UserForm => ({
  id: createId(),
  userName: "",
  email: "",
  password: "",
  posts: [createEmptyPost()],
});

const createInitialUsers = () => [createEmptyUser()];

const toActionPayload = (users: UserForm[]) => ({
  users: users.map((user) => ({
    userName: user.userName,
    email: user.email,
    password: user.password,
    posts: user.posts.map((post) => ({
      title: post.title,
      content: post.content,
      tags: post.tags.map((tag) => ({
        name: tag.name,
      })),
    })),
  })),
});

export default function UserCreatePage() {
  const [users, setUsers] = useState<UserForm[]>(createInitialUsers);
  const [result, setResult] = useState<PageResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateUser = (userId: string, field: keyof Omit<UserForm, "id" | "posts">, value: string) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) => (user.id === userId ? { ...user, [field]: value } : user))
    );
  };

  const updatePost = (
    userId: string,
    postId: string,
    field: keyof Omit<PostForm, "id" | "tags">,
    value: string
  ) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? {
              ...user,
              posts: user.posts.map((post) =>
                post.id === postId ? { ...post, [field]: value } : post
              ),
            }
          : user
      )
    );
  };

  const updateTag = (userId: string, postId: string, tagId: string, value: string) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? {
              ...user,
              posts: user.posts.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      tags: post.tags.map((tag) =>
                        tag.id === tagId ? { ...tag, name: value } : tag
                      ),
                    }
                  : post
              ),
            }
          : user
      )
    );
  };

  const addUser = () => {
    setUsers((currentUsers) => [...currentUsers, createEmptyUser()]);
  };

  const removeUser = (userId: string) => {
    setUsers((currentUsers) =>
      currentUsers.length === 1 ? currentUsers : currentUsers.filter((user) => user.id !== userId)
    );
  };

  const addPost = (userId: string) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId ? { ...user, posts: [...user.posts, createEmptyPost()] } : user
      )
    );
  };

  const removePost = (userId: string, postId: string) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? {
              ...user,
              posts:
                user.posts.length === 1
                  ? user.posts
                  : user.posts.filter((post) => post.id !== postId),
            }
          : user
      )
    );
  };

  const addTag = (userId: string, postId: string) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? {
              ...user,
              posts: user.posts.map((post) =>
                post.id === postId ? { ...post, tags: [...post.tags, createEmptyTag()] } : post
              ),
            }
          : user
      )
    );
  };

  const removeTag = (userId: string, postId: string, tagId: string) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? {
              ...user,
              posts: user.posts.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      tags:
                        post.tags.length === 1
                          ? post.tags
                          : post.tags.filter((tag) => tag.id !== tagId),
                    }
                  : post
              ),
            }
          : user
      )
    );
  };

  const resetUsers = () => {
    setUsers(createInitialUsers());
    setResult(null);
  };

  const handleCreate = () => {
    setResult(null);
    startTransition(async () => {
      const actionResult = await createUsersWithPostsAndTagsAction(toActionPayload(users));
      setResult(actionResult);
    });
  };

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">批量创建</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            创建多个用户、文章和标签
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            点击创建后会通过 Server Action 调用{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5">
              batchCreateUserWithPostsAndTags
            </code>
            ，一次性写入用户、文章、标签和关联表。
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={isPending}
              type="button"
              onClick={handleCreate}
            >
              {isPending ? "创建中..." : "批量创建"}
            </button>
            <button
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
              disabled={isPending}
              type="button"
              onClick={addUser}
            >
              添加用户
            </button>
            <button
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
              disabled={isPending}
              type="button"
              onClick={resetUsers}
            >
              重置
            </button>
          </div>

          {result ? (
            <div
              className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
                result.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {result.success ? (
                <p>
                  {result.message}：用户 {result.summary.users} 个，文章 {result.summary.posts} 篇，
                  标签 {result.summary.tags} 个，关联 {result.summary.postsTags} 条。
                </p>
              ) : (
                <p>{result.error}</p>
              )}
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-6">
          {users.map((user, userIndex) => (
            <article
              className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
              key={user.id}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-500">用户 #{userIndex + 1}</p>
                  <h2 className="mt-1 text-xl font-semibold">用户信息</h2>
                </div>
                <button
                  className="self-start rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-400 disabled:cursor-not-allowed disabled:text-red-300"
                  disabled={isPending || users.length === 1}
                  type="button"
                  onClick={() => removeUser(user.id)}
                >
                  删除用户
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-700">用户名</span>
                  <input
                    className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                    placeholder="例如 Alice"
                    value={user.userName}
                    onChange={(event) => updateUser(user.id, "userName", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-700">邮箱</span>
                  <input
                    className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                    placeholder="alice@example.com"
                    type="email"
                    value={user.email}
                    onChange={(event) => updateUser(user.id, "email", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-zinc-700">密码</span>
                  <input
                    className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                    placeholder="demo password"
                    type="password"
                    value={user.password}
                    onChange={(event) => updateUser(user.id, "password", event.target.value)}
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">文章列表</h3>
                  <button
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
                    disabled={isPending}
                    type="button"
                    onClick={() => addPost(user.id)}
                  >
                    添加文章
                  </button>
                </div>

                {user.posts.map((post, postIndex) => (
                  <div className="rounded-2xl bg-zinc-50 p-4" key={post.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <p className="text-sm font-medium text-zinc-500">文章 #{postIndex + 1}</p>
                      <button
                        className="self-start rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-400 disabled:cursor-not-allowed disabled:text-red-300"
                        disabled={isPending || user.posts.length === 1}
                        type="button"
                        onClick={() => removePost(user.id, post.id)}
                      >
                        删除文章
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-zinc-700">标题</span>
                        <input
                          className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                          placeholder="文章标题"
                          value={post.title}
                          onChange={(event) =>
                            updatePost(user.id, post.id, "title", event.target.value)
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-zinc-700">内容</span>
                        <textarea
                          className="min-h-24 rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                          placeholder="文章内容"
                          value={post.content}
                          onChange={(event) =>
                            updatePost(user.id, post.id, "content", event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-zinc-700">标签</p>
                        <button
                          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
                          disabled={isPending}
                          type="button"
                          onClick={() => addTag(user.id, post.id)}
                        >
                          添加标签
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {post.tags.map((tag) => (
                          <div className="flex gap-2" key={tag.id}>
                            <input
                              className="min-w-0 flex-1 rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                              placeholder="例如 drizzle"
                              value={tag.name}
                              onChange={(event) =>
                                updateTag(user.id, post.id, tag.id, event.target.value)
                              }
                            />
                            <button
                              className="rounded-full border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:border-red-400 disabled:cursor-not-allowed disabled:text-red-300"
                              disabled={isPending || post.tags.length === 1}
                              type="button"
                              onClick={() => removeTag(user.id, post.id, tag.id)}
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
