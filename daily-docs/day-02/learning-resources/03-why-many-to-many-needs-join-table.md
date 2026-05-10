# 03 · 为什么多对多必须用中间表

## 核心矛盾

- 外键的规则：**单数**（字段 = 另一张表某一行的主键，**一个**）
- 多对多的现实：**复数**（post=1 同时对应 tag=3、tag=5、tag=7）

**单数字段装不下复数关系**。这不是风格选择，是硬性矛盾。

## 反面尝试：不用中间表会怎样？

假设在 posts 表加 `tag_id` 指向 tags：

```
posts
------
id   title       tag_id
1    Hello       3
2    Day 2 note  ?    ← 想同时贴 tag=5、7、9，格子里填什么？
```

- 填 `5` → 丢了 7 和 9
- 填 `"5,7,9"` → 字符串，外键约束失效（数据库无法校验每个 id 是否真存在）
- 复制整行三次 → 其实就是中间表，只是混在了 posts 里（title 冗余 3 遍，id 不能当主键了）

同理，在 users 表加一列 `post_ids` 想存"Alice 发了 10 篇 post" —— 一格也装不下 10 个值。

## 关联表 = 两个外键背靠背的一对多

多对多本质上就是**两个一对多拼起来**：

```
posts ← 一对多 → posts_tags ← 一对多 → tags
```

- posts_tags 里 `post_id` 指向 posts（一对多）
- posts_tags 里 `tag_id` 指向 tags（一对多）

所以多对多没有新概念，就是外键规则的复用。

## 用"行"表达"多"

中间表能解决问题的关键：**把"多"的那一维拆到了"行"里**。

```
posts_tags
-----------
post_id   tag_id
1         3         ← 一行 = 一次关联
1         5
1         7
2         3
2         9
```

每一行只记**一次**关联，`post_id` 和 `tag_id` 都是单数，外键规则成立。想加第 100 个关联就插第 100 行，永远不会撑爆任何一个字段。

**用行的数量表达"多"，而不是用字段里塞多个值** —— 这是关系数据库的核心思路。

## 关联表扩展：带属性的中间表

现实中很常见，比如：
- `user_courses`（一个 user 学多门 course）→ 还要存 `enrolled_at`、`progress`、`completed_at`
- `orders_products` → 还要存 `quantity`、`unit_price`

```
user_courses
-------------
user_id  |  course_id  |  enrolled_at  |  progress
```

这时中间表从"纯关联"升级成了**业务实体**（Enrollment 报名记录），ORM 文档里叫它 **"join table with extra fields"**。

## 一句话总结

外键 = 单值指针。
多对多 = 多值关系。
**单值指针表达不了多值关系，所以必须借助"一张表里多行"来承载。那张表就是中间表。**
