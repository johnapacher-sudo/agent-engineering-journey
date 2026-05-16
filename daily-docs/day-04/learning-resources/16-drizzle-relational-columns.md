# Drizzle Relational API：with + columns 精确控制

## columns 选项

Relational API 的 `with` 支持 `columns` 控制只 select 特定列：

```ts
db.query.posts.findMany({
  with: {
    author: {
      columns: { name: true }
    }
  }
});
```

生成的 SQL：`SELECT name FROM users WHERE ...`，其他字段不会查出来。

## 注意点

- `columns` 只能**减少**字段，不能加——必须是表里已有的列
- 没写 `columns`，默认取全部字段
- 嵌套 `with` 里每一层都可以独立设置 `columns`
