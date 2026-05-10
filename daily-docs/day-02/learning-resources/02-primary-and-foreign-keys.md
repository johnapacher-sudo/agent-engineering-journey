# 02 · 主键与外键

## 主键（Primary Key）

- **本质**：一张表里唯一标识一行的字段
- **要求**：必须唯一、必须非空
- **心智模型**："这张表每一行的身份证号"

## 外键（Foreign Key）

- **本质**：一张表里的一个字段，它的值必须等于另一张表某行的主键
- **心智模型**："指向别人的指针"
- **数据库保证**：引用完整性 —— 你不能插入一条 `user_id=999` 的 post，如果 users 表里没有 id=999

## 对比表

| | 主键 | 外键 |
|---|---|---|
| 作用 | 标识自己这行 | 指向别的表的一行 |
| 唯一？ | 必须唯一 | 可以重复 |
| 非空？ | 必须非空 | 可以为 NULL |
| 一张表几个？ | 通常 1 个 | 可以有 0、1、多个 |

## 关键概念澄清

**外键是字段上的一个约束（constraint），不是一种特殊字段类型**。它本质上就是一个普通字段（如 INTEGER），`REFERENCES users(id)` 是挂在它身上的约束。

约束家族：
- `PRIMARY KEY` — 主键约束
- `FOREIGN KEY ... REFERENCES` — 外键约束
- `UNIQUE` — 唯一约束
- `NOT NULL` — 非空约束
- `CHECK (age > 0)` — 业务规则约束

## 一张表可以有多个外键

非常常见。例如一张订单表：

```typescript
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId:    integer('user_id').references(() => users.id),
  productId: integer('product_id').references(() => products.id),
  addressId: integer('address_id').references(() => addresses.id),
  couponId:  integer('coupon_id').references(() => coupons.id),
});
```

一个字段也可以**同时是主键 + 外键**（一对一场景）：

```typescript
export const profiles = pgTable('profiles', {
  userId: integer('user_id').primaryKey().references(() => users.id),
  bio: text('bio'),
});
```

**心智模型**：主键管"我是谁"，外键管"我和谁有关"。一个人有几个朋友都正常。
