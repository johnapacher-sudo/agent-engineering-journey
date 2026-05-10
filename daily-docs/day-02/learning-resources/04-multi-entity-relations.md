# 04 · 多实体复杂关系

## 三个实体两两多对多 → 3 张中间表

例子：`posts / tags / tips` 三者两两多对多。

```
posts ↔ tags    →  posts_tags    （post 贴了哪些 tag）
posts ↔ tips    →  posts_tips    （post 关联了哪些 tip）
tags  ↔ tips    →  tags_tips     （tag 下有哪些 tip）
```

每张表职责独立，**不要试图合并**。

## 多实体增长公式

C(n,2) = n×(n-1)/2

| 实体数 | 最多中间表数 |
|---|---|
| 2 | 1 |
| 3 | 3 |
| 4 | 6 |
| 5 | 10 |

看着多，但现实项目里不是每两个实体都多对多，可控。

## 两方 vs 三方中间表判断

**核心问题**："关联这件事是两方决定的，还是三方共同决定的？"

| 场景 | 几方 | 做法 |
|---|---|---|
| "这个 post 有哪些 tag" | 两方 | `posts_tags` 两方表 |
| "Alice 给哪些 post 点了赞" | 两方 | `user_likes_posts` 两方表 |
| "哪个用户在哪个 post 下贴了哪个 tag"（协作场景） | 三方 | `user_post_tags` 三方表 |

如果 post 自带作者（`posts.user_id`），问"Alice 贴过哪些 tag"就不需要三方表 —— 走 JOIN 从 post 反查 user 即可。

三方表的例子（Notion 式权限）：

```
user_workspace_page_permissions
-------------------------------
user_id   workspace_id   page_id   permission
```

三个字段都是外键，复合主键是 `(user_id, workspace_id, page_id)`。

## 反模式警告：多态关联

> "能不能做一张通用的 `relations(source_type, source_id, target_type, target_id)` 塞所有关系？"

**不要**。问题：
- 外键约束做不了（外键必须指定目标表，不能"视 type 而定"）
- 查询要额外过滤 type，性能差
- 数据库引用完整性基本失效，脏数据随时进来

除非通用评论系统这种特殊场景（评论可以挂在任何实体上），否则老实每对一张表。

## 一个判断原则

**每张表职责单一 = 未来好扩展**。这里的"重复"是健康的，不是 DRY 违反。
