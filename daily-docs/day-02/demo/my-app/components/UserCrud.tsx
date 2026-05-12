'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  createUser,
  updateUser,
  deleteUser,
  type CreateUserInput,
  type UpdateUserInput,
} from '@/app/demo/actions';

const inputCls =
  'w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500';

const btnCls =
  'rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';

const btnDangerCls =
  'rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50';

type Message =
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string };

export function UserCrud() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');

  const [updateId, setUpdateId] = useState('');
  const [updateName, setUpdateName] = useState('');
  const [updateAge, setUpdateAge] = useState('');
  const [updateEmail, setUpdateEmail] = useState('');

  const [deleteId, setDeleteId] = useState('');

  const run = (
    action: () => Promise<void>,
    onSuccess: () => void,
    successText: string,
  ) => {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        onSuccess();
        setMessage({ kind: 'success', text: successText });
        router.refresh();
      } catch (e) {
        setMessage({
          kind: 'error',
          text: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const handleCreate = () => {
    const input: CreateUserInput = {
      name,
      age: Number(age),
      email,
    };
    run(
      () => createUser(input),
      () => {
        setName('');
        setAge('');
        setEmail('');
      },
      `已创建 user：${input.name}`,
    );
  };

  const handleUpdate = () => {
    const input: UpdateUserInput = {
      id: Number(updateId),
    };
    if (updateName.trim()) input.name = updateName;
    if (updateEmail.trim()) input.email = updateEmail;
    if (updateAge.trim()) input.age = Number(updateAge);

    run(
      () => updateUser(input),
      () => {
        setUpdateId('');
        setUpdateName('');
        setUpdateAge('');
        setUpdateEmail('');
      },
      `已更新 user #${input.id}`,
    );
  };

  const handleDelete = () => {
    const id = Number(deleteId);
    if (!Number.isFinite(id)) {
      setMessage({ kind: 'error', text: 'id 必须是数字' });
      return;
    }
    if (
      !window.confirm(
        `确定删除 user #${id}？该用户的 posts / tags / tips / posts_tags 会被级联删除。`,
      )
    ) {
      return;
    }
    run(
      () => deleteUser({ id }),
      () => setDeleteId(''),
      `已删除 user #${id}`,
    );
  };

  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        users — create / update / delete
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Client Component · onClick
        </span>
      </h3>

      {message && (
        <div
          className={`mb-3 rounded px-2 py-1 text-xs ${
            message.kind === 'success'
              ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            className={inputCls}
            disabled={isPending}
          />
          <input
            value={age}
            onChange={(e) => setAge(e.target.value)}
            type="number"
            placeholder="age"
            className={inputCls}
            disabled={isPending}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="email"
            className={inputCls}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className={btnCls}
          >
            {isPending ? '...' : 'createUser'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            value={updateId}
            onChange={(e) => setUpdateId(e.target.value)}
            type="number"
            placeholder="id"
            className={inputCls}
            disabled={isPending}
          />
          <input
            value={updateName}
            onChange={(e) => setUpdateName(e.target.value)}
            placeholder="name (可选)"
            className={inputCls}
            disabled={isPending}
          />
          <input
            value={updateAge}
            onChange={(e) => setUpdateAge(e.target.value)}
            type="number"
            placeholder="age (可选)"
            className={inputCls}
            disabled={isPending}
          />
          <input
            value={updateEmail}
            onChange={(e) => setUpdateEmail(e.target.value)}
            type="email"
            placeholder="email (可选)"
            className={inputCls}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isPending}
            className={btnCls}
          >
            {isPending ? '...' : 'updateUser'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            value={deleteId}
            onChange={(e) => setDeleteId(e.target.value)}
            type="number"
            placeholder="id"
            className={inputCls}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className={btnDangerCls}
          >
            {isPending ? '...' : 'deleteUser'}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        提示：删除 user 会因 <code>onDelete: &apos;cascade&apos;</code> 级联删除其
        posts / tags / tips / posts_tags。
      </p>
    </div>
  );
}
