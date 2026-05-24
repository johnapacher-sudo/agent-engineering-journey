"use client";

import { useCallback, useState } from "react";

type UserInfoFilter = {
  userId: string;
  postId: string;
  tagId: string;
};

type Tag = {
  id: number;
  name: string;
};

type PostTagGroup = {
  postId: number | null;
  tagId: number | null;
  tag: Tag | null;
};

type Post = {
  id: number;
  title: string;
  content: string;
  tagGroups: PostTagGroup[];
};

type UserInfo = {
  id: number;
  userName: string;
  email: string;
  posts: Post[];
};

const initialFilter: UserInfoFilter = {
  userId: "",
  postId: "",
  tagId: "",
};

const filterFields: Array<{
  key: keyof UserInfoFilter;
  label: string;
  placeholder: string;
}> = [
  { key: "userId", label: "用户 ID", placeholder: "例如 1" },
  { key: "postId", label: "文章 ID", placeholder: "例如 2" },
  { key: "tagId", label: "标签 ID", placeholder: "例如 3" },
];

const buildListUrl = (filter: UserInfoFilter) => {
  const searchParams = new URLSearchParams();

  filterFields.forEach(({ key }) => {
    const value = filter[key].trim();
    if (value) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `/api/user/list?${queryString}` : "/api/user/list";
};

export default function UserListPage() {
  const [filter, setFilter] = useState<UserInfoFilter>(initialFilter);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async (nextFilter: UserInfoFilter) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(buildListUrl(nextFilter));
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "获取用户列表失败");
      }

      setUsers(result.data ?? []);
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : "获取用户列表失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateFilter = (key: keyof UserInfoFilter, value: string) => {
    setFilter((currentFilter) => ({
      ...currentFilter,
      [key]: value,
    }));
  };

  const handleSearch = () => {
    void loadUsers(filter);
  };

  const handleReset = () => {
    setFilter(initialFilter);
    void loadUsers(initialFilter);
  };

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-medium text-zinc-500">用户信息查询</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              按用户、文章、标签筛选
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              点击查询后会调用{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5">/api/user/list</code>，
              并只展示命中条件的文章和标签。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {filterFields.map((field) => (
              <label key={field.key} className="flex flex-col gap-2">
                <span className="text-sm font-medium text-zinc-700">{field.label}</span>
                <input
                  className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                  inputMode="numeric"
                  min="1"
                  placeholder={field.placeholder}
                  type="number"
                  value={filter[field.key]}
                  onChange={(event) => updateFilter(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={isLoading}
              type="button"
              onClick={handleSearch}
            >
              {isLoading ? "查询中..." : "查询"}
            </button>
            <button
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
              disabled={isLoading}
              type="button"
              onClick={handleReset}
            >
              清空筛选
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">查询结果</h2>
            <span className="text-sm text-zinc-500">共 {users.length} 个用户</span>
          </div>

          {!isLoading && users.length === 0 && !error ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              暂无数据，可以调整筛选条件后重试。
            </div>
          ) : null}

          {users.map((user) => (
            <article
              className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
              key={user.id}
            >
              <div className="flex flex-col gap-1 border-b border-zinc-100 pb-4">
                <h3 className="text-lg font-semibold">
                  #{user.id} {user.userName}
                </h3>
                <p className="text-sm text-zinc-500">{user.email}</p>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {user.posts.length === 0 ? (
                  <p className="text-sm text-zinc-500">当前筛选下没有匹配文章。</p>
                ) : (
                  user.posts.map((post) => (
                    <div className="rounded-2xl bg-zinc-50 p-4" key={post.id}>
                      <div className="flex flex-col gap-2">
                        <h4 className="font-medium">
                          文章 #{post.id}：{post.title}
                        </h4>
                        <p className="text-sm leading-6 text-zinc-600">{post.content}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {post.tagGroups.length === 0 ? (
                          <span className="text-sm text-zinc-400">无匹配标签</span>
                        ) : (
                          post.tagGroups.map((tagGroup) => (
                            <span
                              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200"
                              key={`${post.id}-${tagGroup.tagId}`}
                            >
                              #{tagGroup.tagId} {tagGroup.tag?.name ?? "未知标签"}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
