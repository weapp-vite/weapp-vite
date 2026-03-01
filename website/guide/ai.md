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

本页只保留 3 个核心章节，按 `Skills -> MCP -> llms.txt` 的顺序落地。

## Skills

`Skills` 负责给 AI 注入稳定的工程流程，减少“回答看起来对、执行却跑偏”的情况。

快速安装：

```bash
npx skills add sonofmagic/skills
```

安装后常用技能：

```text
$weapp-vite-best-practices
$weapp-vite-vue-sfc-best-practices
$wevu-best-practices
$native-to-weapp-vite-wevu-migration
```

建议：

1. 先让 AI 明确使用哪个 Skill，再开始具体任务。
2. 让团队统一 Skill 名称与调用方式，方便复用提示词模板。

## MCP

`MCP` 负责把仓库真实能力暴露给 AI（读代码、搜代码、执行受限命令、调用 weapp-vite CLI）。

默认行为：

1. `weapp-vite` 默认启用 MCP 能力。
2. 默认不会自动启动 MCP 服务（`autoStart: false`）。

手动启动（推荐）：

```bash
weapp-vite mcp --workspace-root /absolute/path/to/weapp-vite
```

需要 HTTP 连接时：

```bash
weapp-vite mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp --workspace-root /absolute/path/to/weapp-vite
```

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
