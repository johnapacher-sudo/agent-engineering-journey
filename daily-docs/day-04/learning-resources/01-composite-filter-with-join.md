# 组合条件 Filter（带 JOIN）

## 核心概念

组合条件 filter = **跨表关联（JOIN）+ 多个 WHERE 条件同时生效**。

## 例子：Agent 应用的记忆检索

表结构：`users → conversations → messages`

```sql
SELECT messages.*
FROM messages
JOIN conversations ON messages.conversation_id = conversations.id
JOIN users ON conversations.user_id = users.id
WHERE users.id = 42
  AND messages.created_at > now() - interval '7 days'
  AND messages.content LIKE '%退款%'
```

三层含义：
- **JOIN**：跨表关联（messages 要通过 conversations 桥接才能"知道"属于哪个 user）
- **组合条件**：多个 WHERE 子句同时生效（用户 + 时间 + 关键词）
- **filter**：筛选，本质就是 WHERE

## Drizzle 写法

```ts
db.select()
  .from(messages)
  .innerJoin(conversations, eq(messages.conversationId, conversations.id))
  .innerJoin(users, eq(conversations.userId, users.id))
  .where(
    and(
      eq(users.id, 42),
      gt(messages.createdAt, sevenDaysAgo),
      like(messages.content, '%退款%')
    )
  )
```

## Agent 场景对应

Memory 检索 = 组合 filter + JOIN：
- 按用户 ID 筛选
- 按时间范围筛选
- 按关键词/主题筛选
- 可能涉及 memories JOIN conversations 多表关联
