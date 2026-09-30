---
title: 小程序改动验收
description: 使用 wv accept 和现有 MCP 执行无模型验收，管理项目授权、确定性场景与当前代码的截图日志证据。
keywords:
  - weapp-vite
  - 验收
  - MCP
  - Codex
  - weapp-acceptance
---

# 小程序改动验收

Codex 等宿主负责编辑代码；weapp-vite 执行构建和可重复场景，返回明确结论与截图、日志。无需额外模型 Key。

```bash
wv accept --init
wv accept --inspect --json
wv mcp print codex
```

`wv mcp init codex` 可在用户主动选择后写入接入配置。沿用同一个 MCP 服务，无需另装一个验收服务。

在 `weapp-acceptance.config.json` 配置 `verification` 和 `acceptance.scenarios`。场景以 route 开始且至少包含一个 assert；支持 find、wait、tap、input、assert 和 screenshot。详见[场景格式](./agent/acceptance)。审阅项目脚本、配置和场景后运行：

```bash
wv accept --trust --json
wv accept --report <jobId> --json
```

默认要求 build 与 devtools；缺失检查或场景不会通过。点击和输入不重试，重启不重放交互。报告 version 2 只有 `passed: true` 且 `snapshot.stale: false` 才代表该检查范围通过。截图是视觉证据，不代表视觉断言或真机验收。

配置选择顺序：`--acceptance-config` 指定的 JSON、新配置、旧 `weapp-agent.config.json`、自动探测。不会拼接多份验收配置；`--inspect` 显示实际来源。新文件只包含 version、verification、acceptance。配置变更后需要重新审阅授权。

MCP 提供 `weapp_project_inspect`、`weapp_acceptance_start`、`weapp_acceptance_status`、`weapp_acceptance_cancel`、`weapp_acceptance_report`。启动取得 jobId 后查询状态，不要通过重复启动任务来轮询。未授权返回可操作状态，不等待终端输入。

运行前安装项目依赖，配置真实测试 AppID，登录微信开发者工具并开启服务端口。使用 `$weapp-acceptance` 指导宿主维护场景、执行检查和读取证据。当前支持微信的 weapp-vite 原生与 Wevu 项目。

独立模型模式继续使用 [`weapp-agent`](./agent/getting-started)，需要 Node 24.15+；无模型入口沿用 weapp-vite 的 Node 支持范围。旧会话和报告目录继续可读。

如需使用自定义状态目录，在启动 CLI 时设置 `WEAPP_AGENT_STATE_DIR`，并在宿主 MCP 服务器的 `env` 中显式传入同一值。部分宿主不会继承终端的全部环境变量；目录不一致时服务会要求重新审阅信任记录。
