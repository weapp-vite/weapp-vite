---
title: '@weapp-agent/cli'
description: 面向微信小程序的模型无关 AI coding agent 与验收 CLI。
keywords: [weapp-agent, ai, mcp, acceptance]
---

# @weapp-agent/cli

`@weapp-agent/cli` 把项目检查、MCP 工具和可选的模型调用编排成可恢复的 coding agent。验收和 MCP 能力不需要 API key；独立 AI 模式才需要配置 provider。

## 安装

```bash
npm install --global @weapp-agent/cli@preview
```

## 初始化与运行

```bash
weapp-agent init --provider openai --model YOUR_MODEL
weapp-agent doctor
weapp-agent --trust run "Add a counter and verify the project"
```

## 会话恢复

```bash
weapp-agent sessions --details
weapp-agent session SESSION_ID --json
weapp-agent resume SESSION_ID "Continue the task"
```

## AI 选择提示

已有 AI 客户端并只需要工具时使用 `wv mcp init <client>`；需要独立的任务会话、信任确认和恢复日志时再选择本 CLI。API key 只放环境变量，不写入项目配置。
