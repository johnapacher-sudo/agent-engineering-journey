# Server / Client 数据边界安全

## 一句话结论

**Server Component 传给 Client Component 的 props 会被序列化到 RSC payload 发送到浏览器**——所有传出去的字段都在用户的 devtools 里可见。**必须主动裁剪敏感字段**，否则等于把 password / token / secret 暴露给所有客户端。

## 真实场景：你 day-03 就差点踩坑

```tsx
// page.tsx (Server Component)
export default async function Page() {
  const users = await getUsers();  // SelectUser[] —— 包含 password 字段！
  return <CrudPost users={users} />;  // ❌ 直接传整个对象到 Client
}

// CrudPost.tsx (Client Component)
function CrudPost({ users }) {
  // users 现在在 RSC payload 里被序列化到浏览器
  // 用户打开 devtools → Network → 看到所有 user 的 password 明文
}
```

## 正确做法：传出去前裁剪

```tsx
// page.tsx
return (
  <CrudPost
    users={users.map((u) => ({
      id: u.id,
      userName: u.userName,
      // ⚠️ 故意不传 email / password
    }))}
  />
);

// CrudPost.tsx
type SimpleUser = { id: number; userName: string };  // 类型卡死边界
function CrudPost({ users }: { users: SimpleUser[] }) {
  // 即使有人想偷传 password，TS 也会报错
}
```

**关键**：用类型把"可传给 client 的数据形状"卡死，防止以后有人不小心 `users={users}` 整个传过去。

## 更彻底：在 query 层就裁剪

```ts
// db/queries/select.ts
export const getUsersSafe = async () => {
  return db.query.usersTable.findMany({
    columns: {
      id: true,
      userName: true,
      email: true,
      // ⚠️ password 故意不选
      createdAt: true,
    },
  });
};
```

**优势**：从源头杜绝敏感字段进入 RSC payload。Server 内部需要 password 时再调 `getUserWithPassword()` 专用函数。

## ⚠️ 比 UI 更严重：明文存密码是反模式

你的 `users` 表里 `password: text('password').notNull()` 直接存明文——**这是 Layer 4 红线级安全问题**：

| 场景 | 后果 |
|---|---|
| DB backup 文件泄露 | 所有用户密码暴露 |
| 团队成员或 contractor 拿到 read-only | 所有用户密码暴露 |
| SQL injection 或 ORM bug | 所有用户密码暴露 |
| 用户重复使用同一密码 | 你这边一泄露，连带他银行/邮箱 |

### 正确做法

业界标准三选一（按推荐度排序）：

| 算法 | 包 | 特点 |
|---|---|---|
| **Argon2id**（2025 推荐） | `argon2` / `@node-rs/argon2` | OWASP 当前 #1 |
| **bcrypt**（业内最广泛） | `bcrypt` / `bcryptjs` | 用了 20 年，稳定 |
| **scrypt**（Node 内置） | `crypto.scrypt` | 无第三方依赖 |

最小改造：

```ts
// schema.ts
password: text('password_hash').notNull(),  // 列名改成 password_hash 更明确

// 注册时
import bcrypt from 'bcryptjs';
const passwordHash = await bcrypt.hash(rawPassword, 12);
await db.insert(usersTable).values({ ..., password: passwordHash });

// 登录时
const ok = await bcrypt.compare(rawPasswordInput, user.password);
```

### 永远不要做的事

- ❌ 明文存
- ❌ MD5 / SHA-1 / SHA-256 直接 hash（GPU 1 秒能跑几十亿次）
- ❌ 自创加密算法
- ❌ 在 UI / API response / log 里返回 password 字段（哪怕 hash 后的）

### 更进一步

生产代码 100% 应该用现成 auth 库：**Better Auth / Clerk / Auth.js**。自己写 auth 是"自己写一次发现 5 个安全漏洞"的领域。学习阶段自己写一次有教学价值，生产不要。

## 心法

1. **Client Component 的 props = 浏览器可见的明文**——任何敏感字段必须在 server 端就剥离。
2. **TypeScript 是边界守门人**：用 `Pick<>` / 专用类型卡死可传字段，防御性编程。
3. **Query 层做"敏感字段白名单"**：`getUsersSafe()` vs `getUserWithPassword()` 分开。
4. **密码 / token / secret 类字段一律 hash 或加密存储**——这是 Layer 4 红线，从 day-03 开始养成习惯。
5. **M3 阶段会换成 Better Auth / Clerk**，但 mental model 现在就要建立。

## 自检题

1. 假设你 RSC 里 `await fetch('/api/admin/secret-keys')` 拿到一堆密钥，准备只展示长度而不展示明文。**你能直接把数据传给 Client Component 吗**？
2. 如果你想在 UI 上展示"密码长度提示"（"你的密码 8 位"），但 DB 里只存了 bcrypt hash，怎么实现？
3. 用户点"忘记密码"，DB 里只有 hash，**怎么"恢复"密码**？为什么这其实是个伪命题？
