"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createPostAction,
  deletePostAction,
  listPostsByUserAction,
  updatePostAction,
} from "@/app/drizzle/actions";

type PostRow = Awaited<ReturnType<typeof listPostsByUserAction>>[number];

type Props = {
  userId: number;
  userName: string;
  onPostsChanged?: () => void;
};

export default function PostsPanel({ userId, userName, onPostsChanged }: Props) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      try {
        const list = await listPostsByUserAction(userId);
        setPosts(list);
      } catch (err) {
        setMessage(`❌ 拉取失败：${(err as Error).message}`);
      }
    });
  };

  useEffect(() => {
    refresh();
    setEditingId(null);
    setMessage("");
  }, [userId]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setMessage("⚠️ 请填写 title 和 content");
      return;
    }
    startTransition(async () => {
      try {
        await createPostAction({ title, content, userId });
        setTitle("");
        setContent("");
        setMessage("✅ 发表成功");
        refresh();
        onPostsChanged?.();
      } catch (err) {
        setMessage(`❌ 发表失败：${(err as Error).message}`);
      }
    });
  };

  const handleStartEdit = (post: PostRow) => {
    setEditingId(post.id);
    setEditTitle(post.title);
    setEditContent(post.content);
  };

  const handleSaveEdit = () => {
    if (editingId == null) return;
    startTransition(async () => {
      try {
        await updatePostAction(editingId, {
          title: editTitle,
          content: editContent,
        });
        setEditingId(null);
        setMessage(`✏️ 已更新 post ${editingId}`);
        refresh();
      } catch (err) {
        setMessage(`❌ 更新失败：${(err as Error).message}`);
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm(`确认删除 post ${id}？`)) return;
    startTransition(async () => {
      try {
        await deletePostAction(id);
        setMessage(`🗑️ 已删除 post ${id}`);
        refresh();
        onPostsChanged?.();
      } catch (err) {
        setMessage(`❌ 删除失败：${(err as Error).message}`);
      }
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {userName} 的帖子（user #{userId}）
        </h3>
        <button
          onClick={refresh}
          disabled={pending}
          className="rounded bg-gray-200 px-3 py-1 text-xs hover:bg-gray-300 disabled:opacity-50"
        >
          刷新
        </button>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-2 rounded border border-gray-200 bg-white p-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          className="w-full rounded border border-gray-300 px-3 py-1 outline-none focus:border-blue-500"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="正文..."
          rows={2}
          className="w-full rounded border border-gray-300 px-3 py-1 outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-blue-500 px-4 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {pending ? "发表中..." : "发表帖子"}
        </button>
      </form>

      {message && (
        <div className="rounded bg-white px-3 py-1 text-xs text-gray-700">
          {message}
        </div>
      )}

      <ul className="space-y-2">
        {posts.length === 0 && (
          <li className="rounded bg-white p-3 text-center text-sm text-gray-400">
            还没有帖子
          </li>
        )}
        {posts.map((p) => (
          <li
            key={p.id}
            className="rounded border border-gray-200 bg-white p-3 text-sm"
          >
            {editingId === p.id ? (
              <div className="space-y-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 outline-none focus:border-blue-500"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-gray-300 px-2 py-1 outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={pending}
                    className="rounded bg-green-500 px-3 py-0.5 text-xs text-white hover:bg-green-600 disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded bg-gray-200 px-3 py-0.5 text-xs hover:bg-gray-300"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium">
                    #{p.id} {p.title}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(p.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-gray-700">
                  {p.content}
                </div>
                <div className="space-x-3 pt-1 text-xs">
                  <button
                    onClick={() => handleStartEdit(p)}
                    className="text-blue-600 hover:underline"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={pending}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    删除
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
