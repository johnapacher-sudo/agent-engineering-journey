"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import {
  createUserAction,
  deleteUserAction,
  listUsersAction,
  updateUserAction,
} from "@/app/drizzle/actions";
import PostsPanel from "@/component/posts-panel";

type UserRow = Awaited<ReturnType<typeof listUsersAction>>[number];

export default function DrizzleDemo() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  const [message, setMessage] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      try {
        const list = await listUsersAction();
        setUsers(list);
      } catch (err) {
        setMessage(`❌ 拉取失败：${(err as Error).message}`);
      }
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !age || !email) {
      setMessage("⚠️ 请填写完整 name / age / email");
      return;
    }
    startTransition(async () => {
      try {
        await createUserAction({ name, age: Number(age), email });
        setName("");
        setAge("");
        setEmail("");
        setMessage("✅ 创建成功");
        refresh();
      } catch (err) {
        setMessage(`❌ 创建失败：${(err as Error).message}`);
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm(`确认删除 user ${id}？（会级联删除其 posts）`)) return;
    startTransition(async () => {
      try {
        await deleteUserAction(id);
        setMessage(`🗑️ 已删除 user ${id}`);
        refresh();
      } catch (err) {
        setMessage(`❌ 删除失败：${(err as Error).message}`);
      }
    });
  };

  const handleStartEdit = (user: UserRow) => {
    setEditingId(user.id);
    setEditName(user.name);
  };

  const handleSaveEdit = () => {
    if (editingId == null) return;
    startTransition(async () => {
      try {
        await updateUserAction(editingId, { name: editName });
        setEditingId(null);
        setMessage(`✏️ 已更新 user ${editingId}`);
        refresh();
      } catch (err) {
        setMessage(`❌ 更新失败：${(err as Error).message}`);
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Drizzle CRUD Demo</h1>

      <form
        onSubmit={handleCreate}
        className="space-y-2 rounded-lg border border-gray-200 p-4"
      >
        <h2 className="font-semibold">新建用户</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="姓名"
            className="rounded border border-gray-300 px-3 py-1 outline-none focus:border-blue-500"
          />
          <input
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="年龄"
            type="number"
            className="w-24 rounded border border-gray-300 px-3 py-1 outline-none focus:border-blue-500"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            type="email"
            className="min-w-[200px] flex-1 rounded border border-gray-300 px-3 py-1 outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-blue-500 px-4 py-1 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {pending ? "提交中..." : "创建"}
          </button>
        </div>
      </form>

      {message && (
        <div className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700">
          {message}
        </div>
      )}

      <div className="rounded-lg border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 p-3">
          <h2 className="font-semibold">用户列表（含 posts 数）</h2>
          <button
            onClick={refresh}
            disabled={pending}
            className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 disabled:opacity-50"
          >
            刷新
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">ID</th>
              <th className="p-2">Name</th>
              <th className="p-2">Age</th>
              <th className="p-2">Email</th>
              <th className="p-2">Posts</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            )}
            {users.map((u) => {
              const expanded = expandedUserId === u.id;
              return (
                <Fragment key={u.id}>
                  <tr className="border-t border-gray-200">
                    <td className="p-2">{u.id}</td>
                    <td className="p-2">
                      {editingId === u.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded border border-gray-300 px-2 py-0.5 outline-none focus:border-blue-500"
                        />
                      ) : (
                        u.name
                      )}
                    </td>
                    <td className="p-2">{u.age}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{String(u.postsCount)}</td>
                    <td className="space-x-2 p-2 whitespace-nowrap">
                      {editingId === u.id ? (
                        <>
                          <button
                            onClick={handleSaveEdit}
                            disabled={pending}
                            className="text-green-600 hover:underline disabled:opacity-50"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-500 hover:underline"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              setExpandedUserId(expanded ? null : u.id)
                            }
                            className="text-purple-600 hover:underline"
                          >
                            {expanded ? "收起帖子" : "查看帖子"}
                          </button>
                          <button
                            onClick={() => handleStartEdit(u)}
                            className="text-blue-600 hover:underline"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={pending}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            删除
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-t border-gray-200">
                      <td colSpan={6} className="bg-gray-50 p-3">
                        <PostsPanel
                          userId={u.id}
                          userName={u.name}
                          onPostsChanged={refresh}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
