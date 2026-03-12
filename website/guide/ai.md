---
title: AI 协作指南
description: 面向 weapp-vite 团队的 AI 协作入口，聚焦 Skills、MCP 与 llms.txt 三大章节。
keywords:
  - guide
  - ai
  - skills
  - mcp
  - llms
  - weapp-vite
---

# AI 协作指南

## Skills

`Skills` 负责给 AI 注入稳定的工程流程，减少“回答看起来对、执行却跑偏”的情况。

如果你是直接使用公开技能仓库，先安装：

```bash
npx skills add sonofmagic/skills
```

如果你正在这个 monorepo 里开发，优先把仓库自带技能链接到本地环境：

```bash
pnpm skills:link
```

只想预览链接结果而不改本地环境时：

```bash
pnpm skills:link:dry
```

当前仓库内常用技能：

```text
$weapp-vite-best-practices
$docs-and-website-sync
$weapp-vite-wevu-performance-best-practices
$weapp-vite-vue-sfc-best-practices
$wevu-best-practices
$native-to-weapp-vite-wevu-migration
$weapp-ide-cli-best-practices
```

建议：

1. 项目架构、分包、构建编排问题优先用 `weapp-vite-best-practices`。
2. 根据现有代码同步 `website`、`skills`、AI 指南时优先用 `docs-and-website-sync`。
3. 卡顿、掉帧、白屏、内存告警优先用 `weapp-vite-wevu-performance-best-practices`。
4. `.vue` 宏、模板兼容、`v-model`/`usingComponents` 问题优先用 `weapp-vite-vue-sfc-best-practices`。
5. `wevu` 生命周期、状态、事件、store 问题优先用 `wevu-best-practices`。
6. 原生小程序迁移到 `weapp-vite + wevu + Vue SFC` 优先用 `native-to-weapp-vite-wevu-migration`。
7. DevTools 自动化、`preview/upload/automator/config` 命令治理优先用 `weapp-ide-cli-best-practices`。
8. 先让 AI 明确使用哪个 Skill，再开始具体任务。

## MCP

`MCP` 负责把仓库真实能力暴露给 AI（读代码、搜代码、执行受限命令、调用 weapp-vite CLI）。

默认行为：

1. `weapp-vite` 默认启用 MCP 能力。
2. 默认不会自动启动 MCP 服务（`autoStart: false`）。

手动启动（推荐）：

```bash
weapp-vite mcp
```

需要 HTTP 连接时：

```bash
weapp-vite mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp
```

可选：不在仓库目录执行时，再加 `--workspace-root /path/to/weapp-vite`。

### 示例：驱动 weapp-vite screenshot 做验收

前置条件：

1. AI 客户端已接入 `weapp-vite` MCP。
2. 微信开发者工具已登录，并开启「设置 -> 安全设置 -> 服务端口」。

可直接复制的提示词：

```text
你现在连接的是 weapp-vite MCP。请帮我完成一次小程序截图验收：
1. 构建 e2e-apps/auto-routes-define-app-json（platform=weapp）。
2. 执行 weapp-vite screenshot，参数如下：
   - project: e2e-apps/auto-routes-define-app-json/dist/build/mp-weixin
   - page: pages/home/index
   - output: .tmp/mcp-screenshot.png
   - 使用 --json 返回结果
3. 检查 .tmp/mcp-screenshot.png 是否存在：
   - 存在输出 screenshot-ok
   - 不存在输出 screenshot-missing
4. 最后汇总：执行命令、关键输出、最终结论。
```

期望结果：

1. AI 输出 `screenshot-ok`。
2. 工作区产出 `.tmp/mcp-screenshot.png`。

## llms.txt

`llms.txt` 负责给模型稳定喂上下文，减少遗漏与误判。

可用资源：

1. `/llms.txt`：轻量索引。
2. `/llms-full.txt`：完整语料。
3. `/llms-index.json`：结构化索引。

推荐喂给顺序：

1. 先 `/llms.txt` 建立目录语义。
2. 再按需读取 `/llms-full.txt`。
3. 最后结合 `/llms-index.json` 做结构化定位。

## 关联阅读

1. [CLI 命令参考](/guide/cli)
2. [共享配置：weapp.mcp](/config/shared#weapp-mcp)
3. [@weapp-vite/mcp 包说明](/packages/mcp)
4. [AI 学习入口](/ai)
