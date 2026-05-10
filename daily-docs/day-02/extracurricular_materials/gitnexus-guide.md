# GitNexus 完整使用指南

> 本文档基于 GitNexus v1.6.3，记录于 2025/05/09

## 一、GitNexus 是什么

GitNexus 是一个**零服务端代码智能引擎**。它用 tree-sitter 解析代码，提取符号和关系，构建知识图谱（Knowledge Graph），然后通过 MCP 协议暴露给 AI 编码助手（Claude Code、Cursor、Codex 等）。

**核心价值：** 让 AI 代理对代码库有全局架构视角，不再遗漏依赖、破坏调用链、盲目修改。

**一句话总结：** 把代码变成结构化的图数据库，给 AI 用。

### 和 RAG 的区别

| | RAG | 知识图谱 |
|---|---|---|
| 存储的是 | 文本切片 + 向量 | 实体 + 关系 |
| 查询方式 | 语义相似度 | 结构化遍历 |
| 能回答"相关吗" | 能 | 能 |
| 能回答"谁调用了谁" | 不能（只能猜） | 能（精确） |
| 能回答"影响范围" | 模糊 | 精确到具体路径 |
| 能回答"调用链顺序" | 不能 | 能（STEP_IN_PROCESS） |

GitNexus 的 `query` 工具是两者结合：BM25（关键词）+ 向量搜索找候选 → 图谱结构排序。其他核心工具（impact、context、rename、detect_changes、cypher）都是纯图遍历，不依赖 RAG。

**知识图谱才是底层核心，RAG（embeddings）只是 query 工具的可选增强。**

## 二、安装与配置

### 安装

```bash
npm install -g gitnexus
```

### 两种使用方式

| 方式 | 说明 |
|------|------|
| CLI + MCP（推荐） | 本地索引仓库，通过 MCP 连接 AI 编辑器 |
| Web UI | 浏览器内交互式图谱探索 + AI 聊天，适合快速浏览和演示 |

### 全局配置（一次性）

```bash
gitnexus setup
```

这条命令会：
1. 在 `~/.claude.json` 注册 MCP 服务器
2. 在 `~/.claude/hooks/gitnexus/` 安装 Hooks
3. 在 `~/.claude/skills/` 安装全局 Skills（**建议删掉，见第六节**）

### 手动配置 MCP（如果 setup 不生效）

```bash
# Claude Code
claude mcp add gitnexus -- npx -y gitnexus@latest mcp

# 全局安装后更快
claude mcp add gitnexus -- /path/to/gitnexus mcp
```

## 三、知识图谱结构

### 存储位置

```
仓库根目录/.gitnexus/
├── lbug          # LadybugDB 图数据库文件
├── meta.json     # 索引元信息
└── wiki/         # wiki 输出目录
```

### 全局注册表

```
~/.gitnexus/registry.json   # 记录所有已索引仓库的指针
~/.gitnexus/config.json     # 全局配置（API key 等）
```

### 图谱节点类型

| 节点类型 | 说明 |
|---------|------|
| File | 源文件 |
| Folder | 目录 |
| Function | 函数 |
| Class | 类 |
| Method | 类方法 |
| Interface | 接口/类型 |
| Community | 自动检测的功能聚类（Leiden 算法） |
| Process | 执行流（跨函数调用链） |

### 图谱边（关系）类型

| 关系类型 | 含义 |
|---------|------|
| CONTAINS | 文件夹包含文件 |
| DEFINES | 文件定义了符号 |
| CALLS | 函数/方法调用 |
| IMPORTS | 模块导入 |
| EXTENDS | 类继承 |
| IMPLEMENTS | 接口实现 |
| HAS_METHOD | 类拥有方法 |
| HAS_PROPERTY | 类拥有属性 |
| ACCESSES | 读写属性（reason: read/write） |
| METHOD_OVERRIDES | 方法重写 |
| MEMBER_OF | 符号属于功能聚类 |
| STEP_IN_PROCESS | 符号是执行流的第 N 步 |

### 示例数据（fleetpipe 仓库）

- 125 文件、3519 符号、6549 关系、76 聚类、297 执行流
- 核心类：FleetpipeApp（85 个方法）、DefaultGitOperations、HookEngine
- 三层架构：`src/application`、`src/domain`、`src/infrastructure`

## 四、CLI 命令参考

### 索引管理

```bash
gitnexus analyze [path]           # 索引仓库（增量更新）
gitnexus analyze --force          # 强制全量重建
gitnexus analyze --embeddings     # 启用语义搜索（更慢但更准）
gitnexus analyze --skills         # 生成仓库专属 skill 文件
gitnexus analyze --skip-agents-md # 不覆盖手动改过的 CLAUDE.md
gitnexus analyze --skip-embeddings # 跳过 embedding 生成
gitnexus analyze --verbose        # 显示被跳过的文件
gitnexus analyze --skip-git       # 索引非 Git 目录
```

### 查看状态

```bash
gitnexus list                     # 列出所有已索引仓库
gitnexus status                   # 当前仓库索引状态
```

### 服务

```bash
gitnexus mcp                      # 启动 MCP 服务器（stdio）
gitnexus serve                    # 启动 HTTP 服务 + Web UI 后端（端口 4747）
```

### 清理

```bash
gitnexus clean                    # 删除当前仓库索引
gitnexus clean --all --force      # 删除所有索引
```

### Wiki

```bash
gitnexus wiki [path]              # 从知识图谱生成 Wiki 文档
gitnexus wiki --model <model>     # 指定 LLM 模型
gitnexus wiki --base-url <url>    # 指定 LLM API 地址
gitnexus wiki --api-key <key>     # 指定 LLM API key
gitnexus wiki --gist              # 发布到 GitHub Gist
```

### 多仓库分组

```bash
gitnexus group create <name>                              # 创建分组
gitnexus group add <group> <path> <registryName>          # 添加仓库到分组
gitnexus group remove <group> <path>                      # 从分组移除
gitnexus group list [name]                                # 列出分组
gitnexus group sync <name>                                # 提取合约并跨仓库关联
gitnexus group contracts <name>                           # 查看合约
gitnexus group query <name> <q>                           # 跨仓库搜索
gitnexus group status <name>                              # 检查索引新鲜度
```

## 五、MCP 工具参考

### 核心 6 个工具

| 工具 | 说明 | 典型场景 |
|------|------|---------|
| `query` | 按概念搜索执行流 | "认证流程是怎么走的" |
| `context` | 某个符号的完整关系网 | "StateRepository.write 的上下游" |
| `impact` | 变更影响范围分析 | "改了这个函数什么会挂" |
| `detect_changes` | git diff 映射到图谱 | "我改的几行影响了哪些执行流" |
| `rename` | 跨文件安全重命名 | "把这个函数改名，找所有引用" |
| `cypher` | 自定义图查询语句 | 上面工具覆盖不到的场景 |

### API 相关工具

| 工具 | 说明 |
|------|------|
| `route_map` | API 路由 → 处理函数 → 消费者的映射 |
| `shape_check` | API 返回值 vs 前端使用的字段对比 |
| `api_impact` | 改 API 接口前的综合影响评估 |
| `tool_map` | MCP/RPC 工具定义和实现位置 |

### 多仓库工具

| 工具 | 说明 |
|------|------|
| `list_repos` | 列出所有已索引仓库 |
| `group_list` | 列出仓库分组 |
| `group_sync` | 提取跨仓库 API 合约 |
| `group_query` | 跨仓库搜索执行流 |
| `group_status` | 检查分组索引新鲜度 |

### MCP 资源

| 资源 URI | 说明 |
|----------|------|
| `gitnexus://repos` | 所有已索引仓库 |
| `gitnexus://repo/{name}/context` | 仓库概览 |
| `gitnexus://repo/{name}/clusters` | 所有功能聚类 |
| `gitnexus://repo/{name}/cluster/{name}` | 聚类详情 |
| `gitnexus://repo/{name}/processes` | 所有执行流 |
| `gitnexus://repo/{name}/process/{name}` | 执行流详情 |
| `gitnexus://repo/{name}/schema` | 图谱 Schema |

## 六、全局 vs 项目级配置最佳实践

### 三个组件的放置策略

| 组件 | 放哪里 | 为什么 |
|------|--------|--------|
| MCP 配置 | 全局 `~/.claude.json` | 纯查询接口，按 `repo` 参数隔离，不会串 |
| Hooks | 全局 `~/.claude/hooks/gitnexus/` | 内部检测 `.gitnexus/` 目录是否存在，未索引仓库自动跳过 |
| Skills | **项目级** `.claude/skills/gitnexus/` | 描述文本会触发 AI 行为，全局会污染未索引仓库 |

### 为什么全局 Skills 有问题

全局 Skills 的描述文本（如 "Use when debugging"）会在所有仓库匹配，导致 AI 在未索引仓库也尝试调用 GitNexus MCP 工具，结果只会拿到空数据或报错。

### 清理方法

```bash
# 删掉全局 skills
rm -rf ~/.claude/skills/gitnexus-*

# 项目级 skills 由 analyze 自动生成，保留
```

### Hooks 为什么不会串

Hooks 内部有 `findGitNexusDir()` 函数，检测当前目录下有没有 `.gitnexus/` 目录：
- 没有 → 直接跳过
- 有 → 才执行 hook 逻辑

这是硬性的文件存在性检查，不会误触发。

### MCP 为什么不会串

MCP 只是查询接口，AI 不会凭空调用它。只有被 Skills 或 CLAUDE.md 规则引导时才会触发。未索引仓库没有这些引导，所以不会调。

## 七、AI 串联机制

### 第一层：CLAUDE.md 强制规则

`gitnexus analyze` 自动在项目 CLAUDE.md 中注入：

```markdown
## Always Do
- MUST run impact analysis before editing any symbol
- MUST run detect_changes() before committing

## Never Do
- NEVER edit without first running impact()
- NEVER rename with find-and-replace — use rename()
```

### 第二层：Skills 决策流程

每个 Skill 定义了特定场景的调用顺序：

```
用户问"X 怎么工作的" → 先调 query() 找执行流
                     → 再调 context() 看符号详情
                     → 组装回答
```

### 全链路

```
用户说："帮我改一下 StateRepository"
  ↓
Claude Code 读到 CLAUDE.md 规则："修改前必须调 impact()"
  ↓
自动调用 impact({ target: "StateRepository", direction: "upstream", repo: "fleetpipe" })
  ↓
MCP 返回精确的结构化 JSON（risk 等级、调用者、受影响执行流）
  ↓
AI 告诉用户影响范围，确认后才修改
```

MCP 工具的参数是结构化的，AI 负责把自然语言翻译成参数，不存在模糊匹配。

## 八、生产项目最佳实践

### 初始化（一次性）

```bash
npm install -g gitnexus
gitnexus setup
rm -rf ~/.claude/skills/gitnexus-*   # 删全局 skills
```

### 每个仓库建索引

```bash
cd /你的仓库

# 小项目（<500 文件）
gitnexus analyze

# 大项目（>500 文件）
gitnexus analyze --embeddings --skills
```

### 保持索引新鲜

```bash
# 推荐：git hook 自动化
# 在 husky 或 .git/hooks/post-commit 里加：
gitnexus analyze --skip-agents-md

# 手动：大改动后跑一次
gitnexus analyze
```

### 日常使用

| 场景 | 工具 | 频率 |
|------|------|------|
| 改代码前 | `impact()` | **必做** |
| 提交前 | `detect_changes()` | **必做** |
| 探索代码 | `query()` + `context()` | 按需 |
| 重构 | `rename()` | 按需 |
| 自定义查询 | `cypher()` | 按需 |

### 不需要做的事

| 操作 | 原因 |
|------|------|
| `gitnexus wiki` | AI 直接读图谱，wiki 是给人看的，非必需 |
| `gitnexus serve` + Web UI | 只是可视化验证，不是日常工具 |
| 每个项目跑 `gitnexus setup` | 全局只跑一次 |

### 最终架构

```
全局（一次配置，永不动）
├── ~/.claude.json               → MCP 配置
├── ~/.claude/hooks/gitnexus/    → Hooks（自动检测 .gitnexus/）
└── ~/.gitnexus/registry.json    → 仓库注册表

每个已索引仓库
├── .gitnexus/lbug               → 知识图谱数据库
├── .gitnexus/meta.json          → 索引元信息
├── .claude/skills/gitnexus/     → 项目级 skills
├── .claude/skills/generated/    → 仓库专属 skills（--skills 生成）
├── .claude/CLAUDE.md            → 强制规则
└── git hook                     → post-commit 自动更新索引

未索引仓库
└── 干干净净，不会误触发任何 gitnexus 逻辑
```

## 九、Wiki 功能

`gitnexus wiki` 基于知识图谱自动生成仓库文档，调用 LLM 把结构化数据翻译成人可读的 Markdown。

```bash
gitnexus wiki                        # 生成文档
gitnexus wiki --model k2.6           # 指定模型
gitnexus wiki --gist                 # 发布到 GitHub Gist
```

适用场景：团队新人看文档、生成项目 Wiki。非 AI 辅助编码的必需品。

注意：输出语言取决于 LLM 的 prompt，GitNexus 内部 prompt 是英文，暂无语言参数。

## 十、Web UI

```bash
gitnexus serve    # 启动后端（端口 4747）
# 浏览器打开 https://gitnexus.vercel.app 自动连接本地服务
```

- `http://localhost:4747` 是后端 API，不是 Web 页面
- Web UI 前端在 https://gitnexus.vercel.app
- 主要用于验证知识图谱是否正确构建，不是日常工具

## 十一、Embeddings（语义搜索）

| 参数 | 何时使用 |
|------|---------|
| `--embeddings` | 仓库大（>500 文件），关键词搜不到东西时 |
| 不加 | 小项目够用，BM25 关键词搜索足够 |

启用后 `query()` 从纯关键词匹配升级为 BM25 + 向量语义搜索。

## 十二、常见问题

### WAL 文件损坏

```
Error: Corrupted wal file. Read out invalid WAL record type.
```

修复：
```bash
cd /你的仓库
rm -rf .gitnexus
gitnexus analyze
```

### Wiki LLM API 404

检查 `~/.gitnexus/config.json` 中的 `baseUrl` 和 `model` 是否正确。

### 新增仓库

只需要：
```bash
cd /新仓库
gitnexus analyze
```

不需要重新 `setup`。MCP 全局注册表会自动识别新仓库。
