---
title: "快速开始"
description: 从已发布 CLI 或 weapp-vite 工作区构建产物启动独立 Agent，配置模型并执行第一个小程序开发任务。
sidebar:
  order: 1
keywords:
  - weapp-agent
  - 快速开始
  - 安装
  - 模型配置
---

如果已经使用 Codex 等 AI 工具，优先阅读[无模型接入与验收](/guide/acceptance)。下文介绍需要模型配置的独立 agent 模式。

## 安装

当前为源码预览版，需要 Node.js 24.15+ 和 pnpm。

从 npm 安装预览版：

```sh
npm install --global @weapp-agent/cli@preview
```

```bash
weapp-agent --version
```

也可以从源码构建：

```bash
git clone https://github.com/weapp-vite/weapp-vite.git
cd weapp-vite
corepack enable
pnpm install
pnpm --filter @weapp-agent/cli... -r build
pnpm --filter @weapp-agent/cli pack --pack-destination ../../artifacts
```

将打包生成的 `.tgz` 安装到全局后即可使用 `weapp-agent`。在仓库中也可以直接运行 `node packages/agent-cli/dist/index.mjs --help`。

## 配置一个现有项目

在小程序目录中运行。模型名使用你账户中可用的标识，不需要修改 agent 源码。

```bash
weapp-agent init --provider openai --model YOUR_MODEL
weapp-agent doctor
weapp-agent --trust run "阅读项目，为首页增加一个计数器，并执行验证"
```

通过终端环境设置 `OPENAI_API_KEY`。不要将密钥写入项目配置或提交到 Git。

`--trust` 表示你已审阅该项目的脚本与配置。之后可以直接运行 `weapp-agent`，进入交互对话。

## 创建新项目

```bash
weapp-agent init ./my-miniapp --create --template wevu --model YOUR_MODEL
cd my-miniapp
pnpm install
weapp-agent --trust
```

原生项目选择 `--template native`。目标目录必须不存在；脚手架使用固定版本的 `create-weapp-vite`。

## 查看结果

终端展示工具进度、编辑差异和会话 ID。检查代码后运行 `weapp-agent verify`，查看构建、测试和微信开发者工具各自的验证状态。

继续阅读[模型配置](/guide/agent/models)、[项目接入](/guide/agent/projects)和[权限](/guide/agent/permissions)。
