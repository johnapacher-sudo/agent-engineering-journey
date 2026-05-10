# Day 2 · 学习笔记索引

> 本目录是一次 AI 问答学习的整理，围绕关系数据库的建模、主外键、Drizzle 语法展开。
> 按主题拆分成小文件，方便按需回看。

## 目录

1. [01-关系三种形态](./01-relations-three-forms.md) — 一对一 / 一对多 / 多对多的判断方法
2. [02-主键与外键](./02-primary-and-foreign-keys.md) — PK / FK 本质、对比、多外键场景
3. [03-为什么多对多必须用中间表](./03-why-many-to-many-needs-join-table.md) — 单数指针 vs 多值关系的矛盾
4. [04-多实体复杂关系](./04-multi-entity-relations.md) — 三实体两两多对多、三方关联表、多态关联反模式
5. [05-关联表反模式](./05-join-table-antipatterns.md) — 合并字段到关联表的代价 + 正规化思路
6. [06-Drizzle 主键方案](./06-drizzle-primary-key.md) — serial vs identity、复合主键、常见误解
7. [07-Migration 演化关系](./07-migration-adding-relations.md) — 后加中间表、generate / push / migrate 区别
8. [08-增删改查改哪张表](./08-crud-which-table.md) — "谁的属性改谁的表" + 场景速查
9. [09-relations vs 外键](./09-relations-vs-foreign-keys.md) — ORM 查询便利 vs DB 层约束的分工
10. [10-索引与复合索引](./10-indexes-and-composite.md) — 最左前缀原则、顺序规则
11. [11-pgEnum vs type](./11-pgenum-vs-type.md) — 强约束 vs 灵活演化的权衡
12. [12-Drizzle Indexes & Constraints](./12-drizzle-indexes-constraints.md) — 官方文档语法全家福
13. [13-命名规范](./13-naming-conventions.md) — PK/FK/UQ 缩写、为什么要自定义名字、命名惯例
14. [14-关联表的索引策略](./14-join-table-index-strategy.md) — 最左前缀用于中间表：只给非最左列补索引
15. [15-命名冲突](./15-naming-conflicts.md) — relation namespace、PK 列不要再加索引
16. [16-复合索引的使用场景](./16-composite-index-use-cases.md) — 过滤+排序、时间窗口、判断流程
17. [17-Use the Index, Luke! Ch.3](./17-use-the-index-luke-ch3.md) — 电话簿比喻、最左前缀、Markus Winand 四条建议

## 核心心法速查

1. **外键 = 单值指针；多对多 = 多值关系；必须靠"一张表多行"承载 → 中间表**
2. **每对多对多各建一张中间表**，不要合并（多态关联是反模式）
3. **关联表字段不要冗余复制其他表字段**，用 JOIN（默认正规化）
4. **实体表主键用 `generatedAlwaysAsIdentity`；关联表用复合主键** —— 两套规则互不冲突
5. **外键管"数据不能乱"（DB 层必须）；`relations()` 管"查询不用累"（TS 层便利）** —— 两个都写
6. **复合索引顺序决定能加速哪些查询**（最左前缀原则）；复合主键免费附送复合索引
7. **演化频繁用 `$type<>()`，稳定后再收口到 `pgEnum`**；单向门优先用可逆选项
