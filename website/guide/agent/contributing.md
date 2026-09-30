---
title: "贡献与验证"
description: "用可复现的行为说明改动。"
sidebar:
  order: 11
---

## 开发

```bash
corepack enable
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:pack
pnpm exec repo doctor
pnpm exec repo check
```

新增包通过 `pnpm exec repo new` 创建。修改受管工具配置通过 `repoctl.config.ts` 和 repoctl 完成。

## 验证层级

常规 CI 使用确定性模型和本地 MCP fixture，不调用付费模型。真实模型测试使用 `pnpm test:live`，需要各 provider 的密钥和 `WEAPP_AGENT_OPENAI_MODEL`、`WEAPP_AGENT_ANTHROPIC_MODEL`。

`pnpm test:devtools` 面向已安装的真实微信开发者工具；设置 `WEAPP_AGENT_DEVTOOLS_FIXTURE` 指向已构建的隔离测试项目，包含 `pages/agent-proof/index`、`#count` 与 `#increment`。真实 AppID、登录态和服务端口需就绪；串行执行，使用同一连接和 reLaunch。缺失凭据或设备的测试明确标记未验证，不算作通过。

## 文档

```bash
pnpm docs:dev
pnpm --filter @weapp-agent/docs typecheck
pnpm --filter @weapp-agent/docs lint:docs
pnpm --filter @weapp-agent/docs build
```

Nimbus 源码由本仓库维护，版本固定为 0.15.0。部署前检查导航、搜索、移动端、主题以及 Markdown 和 llms 端点。
