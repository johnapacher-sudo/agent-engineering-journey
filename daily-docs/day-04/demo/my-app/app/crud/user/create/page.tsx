'use client';

import { useState, useTransition } from 'react';
import { batchCreateUsers } from './action';

interface TagForm {
  id: string;
  name: string;
}

interface PostForm {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  tags: TagForm[];
}

interface UserForm {
  id: string;
  userName: string;
  email: string;
  password: string;
  posts: PostForm[];
}

let nextId = 1;
function uid() {
  return `item-${nextId++}`;
}

function emptyTag(): TagForm {
  return { id: uid(), name: '' };
}

function emptyPost(): PostForm {
  return { id: uid(), title: '', content: '', status: 'draft', tags: [] };
}

function emptyUser(): UserForm {
  return { id: uid(), userName: '', email: '', password: '', posts: [] };
}

// ---------- Tag editor ----------

function TagEditor({
  tags,
  onChange,
}: {
  tags: TagForm[];
  onChange: (tags: TagForm[]) => void;
}) {
  const add = () => onChange([...tags, emptyTag()]);
  const remove = (idx: number) => onChange(tags.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof TagForm, value: string) =>
    onChange(tags.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));

  return (
    <div className="space-y-1.5">
      {tags.map((tag, idx) => (
        <div key={tag.id} className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Tag name"
            value={tag.name}
            onChange={(e) => update(idx, 'name', e.target.value)}
            className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="rounded px-1.5 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        + Add tag
      </button>
    </div>
  );
}

// ---------- Post editor ----------

function PostEditor({
  post,
  onChange,
  onRemove,
}: {
  post: PostForm;
  onChange: (p: PostForm) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof PostForm>(key: K, val: PostForm[K]) =>
    onChange({ ...post, [key]: val });

  return (
    <div className="rounded border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Post
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          Remove
        </button>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          placeholder="Title *"
          value={post.title}
          onChange={(e) => set('title', e.target.value)}
          className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <textarea
          placeholder="Content *"
          value={post.content}
          onChange={(e) => set('content', e.target.value)}
          rows={2}
          className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <select
          value={post.status}
          onChange={(e) =>
            set('status', e.target.value as PostForm['status'])
          }
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <div className="pl-2 border-l-2 border-zinc-200 dark:border-zinc-700">
          <span className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Tags
          </span>
          <TagEditor
            tags={post.tags}
            onChange={(tags) => set('tags', tags)}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- User editor ----------

function UserEditor({
  user,
  onChange,
  onRemove,
}: {
  user: UserForm;
  onChange: (u: UserForm) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof UserForm>(key: K, val: UserForm[K]) =>
    onChange({ ...user, [key]: val });

  const addPost = () => set('posts', [...user.posts, emptyPost()]);
  const updatePost = (idx: number, post: PostForm) =>
    set('posts', user.posts.map((p, i) => (i === idx ? post : p)));
  const removePost = (idx: number) =>
    set('posts', user.posts.filter((_, i) => i !== idx));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          User
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          Remove user
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <input
          type="text"
          placeholder="User name *"
          value={user.userName}
          onChange={(e) => set('userName', e.target.value)}
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <input
          type="email"
          placeholder="Email *"
          value={user.email}
          onChange={(e) => set('email', e.target.value)}
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <input
          type="password"
          placeholder="Password *"
          value={user.password}
          onChange={(e) => set('password', e.target.value)}
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Posts ({user.posts.length})
          </span>
          <button
            type="button"
            onClick={addPost}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add post
          </button>
        </div>

        {user.posts.length === 0 ? (
          <p className="rounded border border-dashed border-zinc-200 px-2 py-3 text-center text-xs text-zinc-400 dark:border-zinc-700">
            No posts yet
          </p>
        ) : (
          user.posts.map((post, idx) => (
            <PostEditor
              key={post.id}
              post={post}
              onChange={(p) => updatePost(idx, p)}
              onRemove={() => removePost(idx)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------- Main page ----------

export default function CreateUserPage() {
  const [users, setUsers] = useState<UserForm[]>([emptyUser()]);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const addUser = () => setUsers((prev) => [...prev, emptyUser()]);
  const updateUser = (idx: number, user: UserForm) =>
    setUsers((prev) => prev.map((u, i) => (i === idx ? user : u)));
  const removeUser = (idx: number) => {
    setUsers((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const payload = users.map((u) => ({
      userName: u.userName,
      email: u.email,
      password: u.password,
      posts: u.posts.map((p) => ({
        title: p.title,
        content: p.content,
        status: p.status,
        tags: p.tags
          .filter((t) => t.name.trim() !== '')
          .map((t) => ({ name: t.name.trim() })),
      })),
    }));

    startTransition(async () => {
      try {
        const result = await batchCreateUsers(payload);
        if (result.success) {
          setMessage({
            type: 'success',
            text: `Created ${(result.data as unknown[]).length} user(s) successfully!`,
          });
          setUsers([emptyUser()]);
        } else {
          setMessage({ type: 'error', text: result.error ?? 'Unknown error' });
        }
      } catch (err) {
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to create users',
        });
      }
    });
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Create Users
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Batch create users with their posts and tags
        </p>
      </header>

      {message && (
        <div
          className={`rounded border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {users.length} user(s)
          </span>
          <button
            type="button"
            onClick={addUser}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            + Add user
          </button>
        </div>

        {users.map((user, idx) => (
          <UserEditor
            key={user.id}
            user={user}
            onChange={(u) => updateUser(idx, u)}
            onRemove={() => removeUser(idx)}
          />
        ))}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? 'Creating...' : 'Create all users'}
          </button>
          <a
            href="/crud/user/list"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            Back to list
          </a>
        </div>
      </form>
    </main>
  );
}
