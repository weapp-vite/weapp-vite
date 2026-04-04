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

这里分两层理解：

1. `skills/*`：公开分发给用户的通用技能，适合安装到自己的 Codex / Claude 环境。
2. `.claude/skills/*`：这个项目仓库内附带的本地附加技能，通常跟本仓库工作流或本地工具链强绑定。

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

公开 skills（`skills/*`）里当前常用的有：

```text
$weapp-vite-best-practices
$docs-and-website-sync
$github-issue-fix-workflow
$release-and-changeset-best-practices
$weapp-devtools-e2e-best-practices
$weapp-vite-wevu-performance-best-practices
$weapp-vite-vue-sfc-best-practices
$wevu-best-practices
$native-to-weapp-vite-wevu-migration
$weapp-ide-cli-best-practices
```

项目本地附加 skills（当前位于 `.claude/skills/*`）按需通过 `pnpm skills:link` 一起同步。

当前仓库内的本地附加 skill 示例：

```text
$playwright-cli
```

建议：

1. 面向用户公开分发的流程优先沉淀到 `skills/*`。
2. 仅对本仓库有效、依赖本地工具链或本地 agent 能力的内容，更适合放到 `.claude/skills/*`。
3. 项目架构、分包、构建编排问题优先用 `weapp-vite-best-practices`。
4. 根据现有代码同步 `website`、`skills`、AI 指南时优先用 `docs-and-website-sync`。
5. GitHub issue 修复、`e2e-apps/github-issues` 复现、PR 闭环优先用 `github-issue-fix-workflow`。
6. changeset、发布、`create-weapp-vite` 联动和提交规范优先用 `release-and-changeset-best-practices`。
7. WeChat DevTools runtime e2e、automator 复用、`reLaunch` 方案优先用 `weapp-devtools-e2e-best-practices`。
8. 卡顿、掉帧、白屏、内存告警优先用 `weapp-vite-wevu-performance-best-practices`。
9. `.vue` 宏、模板兼容、`v-model`/`usingComponents` 问题优先用 `weapp-vite-vue-sfc-best-practices`。
10. `wevu` 生命周期、状态、事件、store 问题优先用 `wevu-best-practices`。
11. 原生小程序迁移到 `weapp-vite + wevu + Vue SFC` 优先用 `native-to-weapp-vite-wevu-migration`。
12. DevTools 自动化、`preview/upload/automator/config` 命令治理优先用 `weapp-ide-cli-best-practices`。
13. 先让 AI 明确使用哪个 Skill，再开始具体任务。

## MCP

`MCP` 负责把仓库真实能力暴露给 AI（读代码、搜代码、执行受限命令、调用 weapp-vite CLI）。

如果你是在其他仓库里使用 `weapp-vite`，而不是在这个 monorepo 里直接开发，推荐先让 AI 读取依赖包里随版本发布的本地文档：

- `node_modules/weapp-vite/dist/docs/index.md`
- `node_modules/weapp-vite/dist/docs/README.md`
- `node_modules/weapp-vite/dist/docs/mcp.md`

这样 AI 会先基于你当前安装版本的本地说明工作，再去执行 `weapp-vite screenshot`、`weapp-vite compare`、`weapp-vite ide logs --open` 或其他 CLI 命令。

### AI 意图路由

如果你希望 AI 在自然语言里稳定命中 mini-program runtime 能力，建议把下面这组映射写进项目级 `AGENTS.md`：

- 提到 `截图`、`页面快照`、`runtime screenshot`
  - 默认使用 `weapp-vite screenshot` / `wv screenshot`
- 提到 `截图对比`、`diff`、`baseline`、`视觉回归`、`像素对比`
  - 默认使用 `weapp-vite compare` / `wv compare`
- 提到 `DevTools 日志`、`运行时日志`
  - 默认使用 `weapp-vite ide logs --open` / `wv ide logs --open`

除非目标明确是 Web runtime，否则不要退化成普通浏览器截图工具。

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
1. 先阅读 node_modules/weapp-vite/dist/docs/index.md 和 node_modules/weapp-vite/dist/docs/mcp.md，确认当前版本的本地说明。
2. 构建 e2e-apps/auto-routes-define-app-json（platform=weapp）。
3. 执行 weapp-vite screenshot，参数如下：
   - project: e2e-apps/auto-routes-define-app-json/dist/build/mp-weixin
   - page: pages/home/index
   - output: .tmp/mcp-screenshot.png
   - 使用 --json 返回结果
4. 检查 .tmp/mcp-screenshot.png 是否存在：
   - 存在输出 screenshot-ok
   - 不存在输出 screenshot-missing
5. 最后汇总：执行命令、关键输出、最终结论。
```

期望结果：

1. AI 输出 `screenshot-ok`。
2. 工作区产出 `.tmp/mcp-screenshot.png`。

### 示例：驱动 weapp-vite compare 做验收

可直接复制的提示词：

```text
你现在连接的是 weapp-vite MCP。请帮我完成一次小程序截图对比验收：
1. 先阅读 node_modules/weapp-vite/dist/docs/index.md、node_modules/weapp-vite/dist/docs/ai-workflows.md 和 node_modules/weapp-vite/dist/docs/mcp.md。
2. 构建 e2e-apps/auto-routes-define-app-json（platform=weapp）。
3. 如果 MCP 提供 `compare_weapp_screenshot` 工具，优先使用它；否则执行 `weapp-vite compare`，参数如下：
   - projectPath: e2e-apps/auto-routes-define-app-json/dist/build/mp-weixin
   - page: pages/home/index
   - baselinePath: .screenshots/baseline/home.png
   - diffOutputPath: .tmp/mcp-home.diff.png
   - maxDiffPixels: 100
   - 使用 JSON 结果
4. 如果对比通过，输出 compare-ok；否则输出 compare-failed。
5. 最后汇总：执行命令、关键输出、最终结论。
```

## AI 终端里的 DevTools 日志桥接

除了 MCP，`weapp-vite` 现在也支持把微信开发者工具里的小程序 `console` 日志直接桥接回 AI 终端。

这对下面几类场景特别有用：

1. 你让 AI 帮你改了一个页面或组件，想立刻看运行时日志。
2. 你在做 DevTools automator / 截图验收，希望终端里同时看到页面报错。
3. 你不想在「代码编辑器 / AI 终端 / DevTools 控制台」之间反复切换。

### 最小工作流

前置条件：

1. 微信开发者工具已登录。
2. 已开启「设置 -> 安全设置 -> 服务端口」。
3. 项目使用 `weapp-vite` 默认配置，或显式开启了 `weapp.forwardConsole`。

如果你当前就在 AI 终端里工作，推荐直接执行：

```bash
pnpm dev --open
```

默认配置下，`weapp.forwardConsole.enabled = 'auto'`。这意味着：

- 在普通人类终端里，默认不会自动附加日志桥。
- 在 Codex、Claude Code、Cursor CLI 等 AI 终端里，会自动尝试把小程序日志桥接回当前终端。

如果你希望手动进入持续监听模式，而不依赖自动检测，可执行：

```bash
weapp-vite ide logs --open
```

这个命令会：

1. 打开微信开发者工具。
2. 连接小程序 automator 会话。
3. 持续输出 `console.log / info / warn / error` 与未捕获异常。
4. 一直保持运行，直到你按 `Ctrl+C` 主动退出。

### 推荐给 AI 的提示词

下面这段提示词适合直接发给接入终端能力的 AI：

```text
请在当前 weapp-vite 项目里帮我做一次 DevTools 终端联调：
1. 用 weapp 平台启动开发命令，并打开微信开发者工具。
2. 如果当前终端没有自动看到小程序 console，请改用 `weapp-vite ide logs --open` 进入持续监听。
3. 复现页面操作后，汇总终端里看到的 console 输出、warn、error 和未捕获异常。
4. 最后给出结论：问题是否已经复现、最关键的日志是哪一条、下一步建议改哪里。
```

### 相关配置

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    forwardConsole: {
      enabled: 'auto',
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    },
  },
})
```

更多字段说明见：[共享配置：weapp.forwardConsole](/config/shared#weapp-forwardconsole)

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
2. [共享配置：weapp.forwardConsole](/config/shared#weapp-forwardconsole)
3. [共享配置：weapp.mcp](/config/shared#weapp-mcp)
4. [调试与贡献](/guide/debug)
5. [@weapp-vite/mcp 包说明](/packages/mcp)
6. [AI 学习入口](/ai)
