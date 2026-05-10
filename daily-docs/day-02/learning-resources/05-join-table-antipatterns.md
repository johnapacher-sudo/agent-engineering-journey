# 05 · 关联表反模式：不要合并字段

## 反面案例

**绝对不要**把 posts 和 tags 的字段合并到 posts_tags：

```
posts_tags (错误设计)
------------------------------------------
post_id   post_title    tag_id   tag_name
1         Hello World   3        AI
1         Hello World   5        学习
1         Hello World   7        笔记
2         Day 2 note    3        AI
```

脑子里的动机大概是："查关联时还要查 posts 和 tags 太麻烦了，不如把 title、tag_name 一起存到 posts_tags，一张表搞定"。

## 为什么这是灾难

1. **数据冗余爆炸**：post=1 有 10 个 tag，`"Hello World"` 就重复存 10 次。一百万 post 各 5 个 tag，重复量不可想象。
2. **更新地狱**：Alice 把 post=1 的 title 改成 "你好世界"。要改**三行**。改漏一行数据就不一致了。
3. **真相分裂**：`posts.title = "你好世界"`，`posts_tags.post_title = "Hello World"`。到底哪个是对的？数据库没法帮你仲裁。
4. **加字段要改一堆表**：给 posts 加一个 `view_count`，要不要也复制到 posts_tags？复制了就要同步维护，不复制就违反"合并字段"的初衷。
5. **存储浪费**：为了省 JOIN，付出了几十倍的磁盘空间。

## 正确思路：JOIN

关系数据库的**核心能力**就是 JOIN —— 它让你**物理上分开存储，逻辑上自由组合**。

```sql
SELECT p.title, t.name
FROM posts p
JOIN posts_tags pt ON pt.post_id = p.id
JOIN tags t        ON t.id = pt.tag_id
WHERE p.id = 1;
```

一条 SQL 把三张表的信息拼回来，性能在有索引的情况下非常快（posts_tags 里的 post_id / tag_id 是外键，通常会建索引）。

## 正规化 vs 反正规化

你刚才的合并思路，在数据库领域叫**反正规化（denormalization）** —— 用空间换查询速度。

**什么时候才考虑反正规化？**
- 读 >>> 写（查询极频繁，更新极少）
- JOIN 性能成为**实测**瓶颈（不是想象的瓶颈）
- 有明确手段保证数据一致性（触发器、定时任务、双写）

**默认一律用正规化**（每个字段只存一份，JOIN 来查询）。反正规化是优化手段，不是默认设计。
