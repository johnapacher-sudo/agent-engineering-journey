# Day 7 · 2026-05-14（周四）

> Week 1 · Postgres + Drizzle
> 今天 1.5-2h · **周复盘日**

## 今天学什么

**主题**：Week 1 收官。不加新知识点、不写新功能，只做三件事：**验收产出、口述自检、写复盘**。

写代码容易产生"我学会了"的错觉。真正验证的方式是：**合上文档、关上 IDE，能不能把一周学的东西自己对着空白文档讲一遍**。今天就是这个仪式。

## 核心概念

今天要完成的心智动作不是"学新东西"，而是"重组旧东西"：

- **产出验收**：Week 1 所有 checklist 是不是真的全部打钩了？不是"大概做了"，是打开仓库能指给我看。
- **口述自检**：三个核心问题，合上文档口述回答。口述是最诚实的检查 —— 说不出来就是没懂。
- **模式识别**：这周遇到的所有"踩坑"里，有没有共同的根源？（通常一个根源解释 3-4 个坑）
- **下周预判**：Week 2 Auth + Payment，哪些 Week 1 的能力会被用到？哪里可能会不够？

## 动手练习

### Part 1 · 产出验收（30 min）

打开项目和 GitHub，逐条对照 Week 1 最低产出：

- [ ] 4 张表 schema（users / posts / tags / posts_tags）+ 外键 + 索引 + relations
- [ ] seed 脚本能跑出 10 user / 50 post / 20 tag / 80 关联
- [ ] Server Actions 完整 CRUD（create / update / delete）
- [ ] list 页支持 status filter + tag filter + cursor 分页
- [ ] 至少一处使用 transaction
- [ ] Neon serverless driver 接入（`neon-http` 或 `neon-serverless`）
- [ ] DATABASE_URL / DATABASE_URL_UNPOOLED 双 env 区分
- [ ] 至少一个 edge runtime route 能查 DB
- [ ] 部署到 Vercel，生产 URL 能访问
- [ ] `notes/drizzle-cheatsheet.md` 存在

每条**没打钩的**都要写清：是没做、做一半、还是做了没记录？

### Part 2 · 口述自检（30 min）

打开录音 / 写文档，合上所有参考资料，回答以下三题。**每题最少 3 分钟讲**：

1. **画出 ER 图**：4 张表之间的外键关系，每条关系说明是一对多还是多对多，为什么这么设计。
2. **为什么 cursor pagination 比 offset 好**：在 100 万行表上 offset 为什么变慢？cursor 的前提是什么？sort 列值重复时怎么办？
3. **Drizzle `with` 的底层 SQL**：`db.query.posts.findMany({ with: { author: true, tags: true } })` 生成的 SQL 大概什么形状？JOIN 还是多次 SELECT？为什么 Drizzle 选这种方式？

答得磕巴的题目，回去把文档**再读一遍**，明天晨间再补一次。

### Part 3 · 周复盘（30 min）

写 `notes/week-01-retro.md`，模板：

```markdown
# Week 1 Retro · 2026-05-08 → 2026-05-14

## 完成度
- 计划 5 个学习日 + 2 个周末深度日
- 实际完成：? / 7
- 欠债：哪些任务没打钩

## 核心学到的 3 件事
1. ...
2. ...
3. ...

## 踩的 3 个坑
1. ...
2. ...
3. ...
共同根源（如果有）：...

## 浪费时间的 1 件事
（直面它。下周避开）

## 阶段评估
- Drizzle：阶段 1 ✓ / 阶段 2 ✓ / 阶段 3 ✗（按计划不进）
- Postgres：阶段 1 ✓ / 阶段 2 部分 / 阶段 3 ✗
- Neon serverless：阶段 1 ✓ / 阶段 2 ✗（留在心智库里，够用）

## 下周预判
Week 2 是 Auth + Payment。预计会用到：
- Drizzle schema 扩展（加 subscriptions、sessions 表）
- Webhook handler（需要 API route，不是 Server Action）
- Transaction（user 注册 + clerkId 同步）
预计不够用：
- ...

## 自我打分（1-10）
- 理解深度：__
- 动手熟练度：__
- 能不能独立讲给别人听：__
```

## 今天结束能回答

- Week 1 最有价值的一个概念是什么？（只选一个）
- 如果有人问你"作为前端，1 周入门 Postgres + Drizzle 应该怎么学"，你会怎么回答？（这是 M1 Day 5 的博客选题的雏形）
- Week 2 开始前，你还有什么疑虑 / 需要的前置知识？

## 晚上 10 min

- `journal.md` 最后一行：**Week 1 完成，Week 2 预备**
- push `notes/week-01-retro.md`
- 休息
- 明天是 Week 2 Day 1，主题 Clerk 接入。今天的 transaction 练习会在"webhook 创建 user"时再出现
