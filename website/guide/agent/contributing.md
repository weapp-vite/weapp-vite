---
title: "贡献与验证"
description: 在 weapp-vite 工作区开发独立 Agent 与验收能力，运行包测试、安装验证、真实模型及 DevTools 检查。
sidebar:
  order: 11
keywords:
  - weapp-agent
  - 贡献
  - 测试
  - DevTools
---

## 开发

```bash
corepack enable
pnpm install
pnpm --filter weapp-vite... --filter @weapp-agent/cli... -r build
pnpm exec eslint packages/agent-* packages/acceptance scripts/weapp-agent
pnpm --filter @weapp-agent/cli... -r typecheck
pnpm --filter @weapp-agent/core --filter @weapp-agent/providers --filter @weapp-agent/mini-program --filter @weapp-agent/cli --filter @weapp-vite/acceptance -r test
pnpm --filter @weapp-agent/core test:types
node scripts/weapp-agent/smoke-pack.mjs
pnpm exec repo doctor
pnpm exec repo check
```

新增包通过 `pnpm exec repo new` 创建。修改受管工具配置通过 `repoctl.config.ts` 和 repoctl 完成。

## 验证层级

常规 CI 使用确定性模型和本地 MCP fixture，不调用付费模型。真实模型测试使用 `node scripts/weapp-agent/live-models.mjs`，需要各 provider 的密钥和 `WEAPP_AGENT_OPENAI_MODEL`、`WEAPP_AGENT_ANTHROPIC_MODEL`。

`node scripts/weapp-agent/devtools-smoke.mjs` 面向已安装的真实微信开发者工具；设置 `WEAPP_AGENT_DEVTOOLS_FIXTURE` 指向已构建的隔离测试项目，包含 `pages/agent-proof/index`、`#count` 与 `#increment`。真实 AppID、登录态和服务端口需就绪；串行执行，使用同一连接和 reLaunch。缺失凭据或设备的测试明确标记未验证，不算作通过。

## 文档

```bash
pnpm --filter website-weapp-vite dev
pnpm seo:quality:strict -- --git-diff-base origin/main
pnpm --filter website-weapp-vite build
```

文档使用现有 VitePress 网站与发布流程。部署前检查导航、搜索、移动端、主题以及 Markdown 和 llms 端点。
