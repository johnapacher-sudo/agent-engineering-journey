'use client';
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  handleAddPost,
  handleAddTag,
  handleAddUser,
  handleDeletePost,
  handleDeleteUser,
} from "@/app/crud/action";
import { handleUpdatePost } from "@/app/crud/post/[id]/edit/action";
import { handleUpdateUser } from "@/app/crud/user/[id]/edit/action";

type SimpleUser = { id: number; userName: string };

type SimplePostOption = { id: number; title: string };

export type PostStatus = 'draft' | 'published' | 'archived';

const POST_STATUS_OPTIONS: PostStatus[] = ['draft', 'published', 'archived'];

const STATUS_ACTIVE_CLS: Record<PostStatus, string> = {
  draft:
    'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  published:
    'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  archived: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
};

type SimpleUserDetail = {
  id: number;
  userName: string;
  email: string;
};

type SimplePost = {
  id: number;
  title: string;
  content: string;
  userId: number;
};

type Message =
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string };

const inputCls =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const btnCls =
  "rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

function MessageBox({ message }: { message: Message | null }) {
  if (!message) return null;
  return (
    <div
      className={`rounded px-2 py-1 text-xs ${
        message.kind === 'success'
          ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
      }`}
    >
      {message.text}
    </div>
  );
}

export const CrudUser = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);

  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleClick = () => {
    if (!userName.trim() || !email.trim() || !password.trim()) {
      setMessage({ kind: 'error', text: '请填写完整' });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        await handleAddUser({
          userName: userName.trim(),
          email: email.trim(),
          password,
        });
        setUserName("");
        setEmail("");
        setPassword("");
        setMessage({ kind: 'success', text: '已创建 user' });
      } catch (e) {
        setMessage({
          kind: 'error',
          text: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-base font-semibold">CrudUser</div>
      <MessageBox message={message} />
      <input
        className={inputCls}
        type="text"
        placeholder="userName"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        disabled={isPending}
      />
      <input
        className={inputCls}
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isPending}
      />
      <input
        className={inputCls}
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isPending}
      />
      <button
        type="button"
        className={btnCls}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? '提交中...' : 'Add User'}
      </button>
    </div>
  );
};

export const CrudPost = ({ users }: { users: SimpleUser[] }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState<string>(
    users[0]?.id.toString() ?? ""
  );

  const hasUsers = users.length > 0;

  const handleClick = () => {
    if (!title.trim() || !content.trim()) {
      setMessage({ kind: 'error', text: '请填写完整' });
      return;
    }
    const parsedUserId = Number(userId);
    if (!Number.isFinite(parsedUserId)) {
      setMessage({ kind: 'error', text: '请选择一个 user' });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
       const res=  await handleAddPost({
          title: title.trim(),
          content: content.trim(),
          userId: parsedUserId,
        });
        console.log(res);
        setTitle("");
        setContent("");
        setMessage({ kind: 'success', text: '已创建 post' });
      } catch (e) {
        console.error(e);
        setMessage({
          kind: 'error',
          text: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-base font-semibold">CrudPost</div>
      <MessageBox message={message} />

      {!hasUsers && (
        <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          请先创建一个 user，post 必须关联到 user。
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          author
        </span>
        <select
          className={inputCls}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={isPending || !hasUsers}
        >
          {!hasUsers && <option value="">(没有可选 user)</option>}
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              #{u.id} · {u.userName}
            </option>
          ))}
        </select>
      </label>

      <input
        className={inputCls}
        type="text"
        placeholder="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isPending || !hasUsers}
      />
      <input
        className={inputCls}
        type="text"
        placeholder="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isPending || !hasUsers}
      />
      <button
        type="button"
        className={btnCls}
        onClick={handleClick}
        disabled={isPending || !hasUsers}
      >
        {isPending ? '提交中...' : 'Add Post'}
      </button>
    </div>
  );
};

export const UpdatePost = ({
  post,
  users,
}: {
  post: SimplePost;
  users: SimpleUser[];
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);

  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [userId, setUserId] = useState<string>(post.userId.toString());

  const hasUsers = users.length > 0;

  const handleClick = () => {
    if (!title.trim() || !content.trim()) {
      setMessage({ kind: 'error', text: '请填写完整' });
      return;
    }
    const parsedUserId = Number(userId);
    if (!Number.isFinite(parsedUserId)) {
      setMessage({ kind: 'error', text: '请选择一个 user' });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        await handleUpdatePost(post.id, {
          title: title.trim(),
          content: content.trim(),
          userId: parsedUserId,
        });
        setMessage({ kind: 'success', text: '已更新 post' });
        router.refresh();
      } catch (e) {
        setMessage({
          kind: 'error',
          text: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const handleBack = () => {
    router.push('/crud');
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">
          UpdatePost <span className="font-mono text-xs text-zinc-500">#{post.id}</span>
        </div>
        <button
          type="button"
          onClick={handleBack}
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← 返回列表
        </button>
      </div>
      <MessageBox message={message} />

      {!hasUsers && (
        <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          没有可选 user。
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          author
        </span>
        <select
          className={inputCls}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={isPending || !hasUsers}
        >
          {!hasUsers && <option value="">(没有可选 user)</option>}
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              #{u.id} · {u.userName}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          title
        </span>
        <input
          className={inputCls}
          type="text"
          placeholder="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          content
        </span>
        <textarea
          className={`${inputCls} min-h-[120px] resize-y`}
          placeholder="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isPending}
        />
      </label>

      <button
        type="button"
        className={btnCls}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? '提交中...' : 'Update Post'}
      </button>
    </div>
  );
};

export const UpdateUser = ({ user }: { user: SimpleUserDetail }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);

  const [userName, setUserName] = useState(user.userName);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");

  const handleClick = () => {
    if (!userName.trim() || !email.trim()) {
      setMessage({ kind: 'error', text: '请填写完整' });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const data: Partial<{ userName: string; email: string; password: string }> = {
          userName: userName.trim(),
          email: email.trim(),
        };
        if (password.trim()) data.password = password;

        await handleUpdateUser(user.id, data);
        setPassword("");
        setMessage({ kind: 'success', text: '已更新 user' });
        router.refresh();
      } catch (e) {
        setMessage({
          kind: 'error',
          text: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const handleBack = () => {
    router.push('/crud');
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">
          UpdateUser <span className="font-mono text-xs text-zinc-500">#{user.id}</span>
        </div>
        <button
          type="button"
          onClick={handleBack}
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← 返回列表
        </button>
      </div>
      <MessageBox message={message} />

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          userName
        </span>
        <input
          className={inputCls}
          type="text"
          placeholder="userName"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          disabled={isPending}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          email
        </span>
        <input
          className={inputCls}
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          password <span className="normal-case text-zinc-400">(留空表示不修改)</span>
        </span>
        <input
          className={inputCls}
          type="password"
          placeholder="留空保持不变"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
        />
      </label>

      <button
        type="button"
        className={btnCls}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? '提交中...' : 'Update User'}
      </button>
    </div>
  );
};

export const CrudTag = ({ posts = [] }: { posts?: SimplePostOption[] }) => {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);
  const [name, setName] = useState("");
  const [postId, setPostId] = useState<string>(""); // "" = 不关联

  const handleClick = () => {
    if (!name.trim()) {
      setMessage({ kind: 'error', text: '请填写 tag 名称' });
      return;
    }
    let parsedPostId: number | undefined;
    if (postId !== "") {
      const n = Number(postId);
      if (!Number.isFinite(n)) {
        setMessage({ kind: 'error', text: '所选 post 无效' });
        return;
      }
      parsedPostId = n;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        await handleAddTag({ name: name.trim(), postId: parsedPostId });
        setName("");
        setPostId("");
        setMessage({
          kind: 'success',
          text: parsedPostId !== undefined
            ? `已创建 tag 并关联到 post #${parsedPostId}`
            : '已创建 tag',
        });
      } catch (e) {
        setMessage({
          kind: 'error',
          text: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleClick();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-base font-semibold">CrudTag</div>
      <MessageBox message={message} />
      <input
        className={inputCls}
        type="text"
        placeholder="tag name (回车提交)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isPending}
      />

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          关联到 post <span className="normal-case text-zinc-400">(可选)</span>
        </span>
        <select
          className={inputCls}
          value={postId}
          onChange={(e) => setPostId(e.target.value)}
          disabled={isPending}
        >
          <option value="">(不关联)</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.id} · {p.title}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={btnCls}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? '提交中...' : 'Add Tag'}
      </button>
    </div>
  );
};

export const PostStatusSwitcher = ({
  postId,
  status,
}: {
  postId: number;
  status: PostStatus;
}) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<PostStatus>(status);

  const handleSwitch = (next: PostStatus) => {
    if (next === optimisticStatus || isPending) return;
    setError(null);
    const prev = optimisticStatus;
    setOptimisticStatus(next);
    startTransition(async () => {
      try {
        await handleUpdatePost(postId, { status: next });
      } catch (e) {
        setOptimisticStatus(prev);
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label="post status"
        className="inline-flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-800"
      >
        {POST_STATUS_OPTIONS.map((s, i) => {
          const active = s === optimisticStatus;
          const isLast = i === POST_STATUS_OPTIONS.length - 1;
          return (
            <button
              key={s}
              type="button"
              onClick={() => handleSwitch(s)}
              disabled={isPending}
              className={`px-2 py-1 text-[11px] font-medium uppercase tracking-wider transition disabled:cursor-not-allowed ${
                active
                  ? STATUS_ACTIVE_CLS[s]
                  : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900'
              } ${isLast ? '' : 'border-r border-zinc-200 dark:border-zinc-800'}`}
            >
              {s}
            </button>
          );
        })}
      </div>
      {isPending && (
        <span className="text-[11px] text-zinc-400">保存中...</span>
      )}
      {error && (
        <span className="text-[11px] text-red-500" title={error}>
          失败
        </span>
      )}
    </div>
  );
};

export const RowActions = ({
  kind,
  id,
}: {
  kind: 'user' | 'post';
  id: number;
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editHref =
    kind === 'user' ? `/crud/user/${id}/edit` : `/crud/post/${id}/edit`;
  const deleteAction = kind === 'user' ? handleDeleteUser : handleDeletePost;

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAction(id);
        // router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href={editHref}
        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        编辑
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        {isPending ? '删除中...' : '删除'}
      </button>
      {error && (
        <span className="text-xs text-red-500" title={error}>
          失败
        </span>
      )}
    </div>
  );
};
