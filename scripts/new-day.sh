#!/usr/bin/env bash
# 快速生成某一天的学习目录：daily-docs/day-NN/
#
# 用法：
#   ./scripts/new-day.sh <day-number> [demo-name]
#
# 示例：
#   ./scripts/new-day.sh 2
#   ./scripts/new-day.sh 2 Drizzle_Advanced_demo
#
# 产出结构（参考 daily-docs/day-01 范式）：
#   daily-docs/day-NN/
#   ├── README.md
#   ├── learning-resources/
#   │   └── .gitkeep
#   └── <demo-name>/            # demo-name 留空时为 demo/
#       └── .gitkeep

set -euo pipefail

# ---- 参数校验 ----
if [[ $# -lt 1 ]]; then
  echo "用法: $0 <day-number> [demo-name]" >&2
  echo "示例: $0 2 Drizzle_Advanced_demo" >&2
  exit 1
fi

DAY_RAW="$1"
DEMO_NAME="${2:-demo}"

if ! [[ "$DAY_RAW" =~ ^[0-9]+$ ]]; then
  echo "错误: day-number 必须是正整数（当前：$DAY_RAW）" >&2
  exit 1
fi

# 两位补零：1 → 01, 12 → 12
DAY_PADDED=$(printf "%02d" "$DAY_RAW")

# ---- 路径定位（脚本在 scripts/ 下，仓库根是上一级）----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_DIR="$REPO_ROOT/daily-docs/day-$DAY_PADDED"
DAILY_MD_REL="daily/day-$DAY_PADDED.md"
DAILY_MD_ABS="$REPO_ROOT/$DAILY_MD_REL"

# ---- 幂等检查：目录已存在则不覆盖 ----
if [[ -d "$TARGET_DIR" ]]; then
  echo "错误: $TARGET_DIR 已存在，未做任何修改。" >&2
  exit 1
fi

# ---- 解析 daily/day-NN.md 的主题，用于 README 简介 ----
TITLE_LINE=""
WEEK_LINE=""
if [[ -f "$DAILY_MD_ABS" ]]; then
  # 第 1 行的 "# Day N · ..." 截出 "·" 之后的日期部分
  TITLE_LINE=$(sed -n '1p' "$DAILY_MD_ABS" | sed 's/^# //')
  # 第 3 行通常是 "> Week 1 · Postgres + Drizzle"
  WEEK_LINE=$(sed -n '3p' "$DAILY_MD_ABS" | sed 's/^> *//')
fi

# ---- 生成 README.md ----
mkdir -p "$TARGET_DIR/learning-resources"
mkdir -p "$TARGET_DIR/$DEMO_NAME"
: > "$TARGET_DIR/learning-resources/.gitkeep"
: > "$TARGET_DIR/$DEMO_NAME/.gitkeep"

HEADING="Day $DAY_RAW"
if [[ -n "$WEEK_LINE" ]]; then
  HEADING_SUB="$WEEK_LINE"
else
  HEADING_SUB="_待补充：参见 daily/day-$DAY_PADDED.md_"
fi

cat > "$TARGET_DIR/README.md" <<EOF
# $HEADING

> $HEADING_SUB

本目录是 Day $DAY_RAW 的学习材料归档。

## 目录结构

- \`learning-resources/\` — 参考文档、笔记、外部资源
- \`$DEMO_NAME/\` — 动手练习的示例项目

## 今天的学习计划

学习目标、核心概念、动手练习、自检题见：

→ [\`$DAILY_MD_REL\`](../../$DAILY_MD_REL)
EOF

# ---- 完成提示 ----
echo "✅ 已创建: $TARGET_DIR"
echo "   ├── README.md"
echo "   ├── learning-resources/"
echo "   └── $DEMO_NAME/"
if [[ ! -f "$DAILY_MD_ABS" ]]; then
  echo ""
  echo "⚠️  提醒: $DAILY_MD_REL 还不存在，README 中的链接会是死链。"
fi
