---
title: "在 Codex 等工具中验收改动"
description: "不配置第二个模型，也能获得小程序构建与运行证据。"
sidebar:
  order: 2
keywords:
  - weapp-agent
  - 验收场景
  - Codex
  - MCP
---

Weapp Agent 提供工程检查和可重复的验收流程。Codex 等宿主继续负责理解需求、修改代码和修复失败；验收服务不调用模型、不要求 API Key。

## 十分钟接入

> 使用 weapp-vite 的用户优先阅读[统一验收入口](../acceptance)。下文保留独立 `weapp-agent` CLI 的兼容用法；新项目建议使用 `weapp-acceptance.config.json`。

安装包含这些命令的本地构建包。在已有 weapp-vite 原生或 Wevu 微信项目中运行：

```bash
weapp-agent init
weapp-agent doctor --json
# 审阅项目脚本、配置和验收场景后执行
weapp-agent --trust accept --json
```

已有配置无需重新 init。默认必须通过 build 和 devtools；没有运行场景时输出 unverified，并以非零退出码结束。首次配置不完整时出现此结果是正常的，不能据此宣称运行验证通过。

## 配置运行场景

在 `weapp-agent.config.json` 中保留现有 verification，添加：

```json
{
  "acceptance": {
    "requiredChecks": ["build", "devtools"],
    "scenarios": ["acceptance/counter.json"],
    "timeoutMs": 600000
  }
}
```

`acceptance/counter.json` 使用实际页面和选择器：

```json
{
  "version": 1,
  "name": "计数器增加",
  "steps": [
    { "action": "route", "path": "/pages/agent-proof/index" },
    { "action": "wait", "selector": "#count" },
    { "action": "assert", "selector": "#count", "text": "0" },
    { "action": "tap", "selector": "#increment" },
    { "action": "assert", "selector": "#count", "text": "1" },
    { "action": "screenshot" }
  ]
}
```

每个场景以 route 开始，名称不能重复，至少包含一个 assert。支持 find、tap、input、wait、assert、screenshot。input 使用 selector 和字符串 value；assert 按 text 精确比较，并按 timeoutMs 轮询。默认等待 5000 毫秒，上限 60000 毫秒。点击、输入和跳转不重试。

执行前需要项目依赖已安装、真实测试 AppID、已登录微信开发者工具并开启服务端口。先构建通过，再复用同一连接执行场景；以 reLaunch 切页。成功场景自动截图，失败场景尽力截图，最后采集控制台日志。

## MCP 与 Skill

启动命令如下，stdout 只承载 MCP 协议：

```bash
weapp-agent -C /absolute/path/to/project mcp
```

宿主的 stdio MCP 配置使用以下 command 和 args。通过宿主自己的设置入口添加，不会自动修改全局设置：

```json
{
  "command": "weapp-agent",
  "args": ["-C", "/absolute/path/to/project", "mcp"]
}
```

首次授权建议在终端审阅后运行 `--trust accept`。服务也支持显式 `--trust mcp`，只信任启动时的配置；场景、脚本或配置变更后需要重新审阅。无需把任何模型凭据放入 MCP 配置。

| 工具 | 作用 |
| --- | --- |
| weapp_project_inspect | 工程事实、支持范围与缺失前提 |
| weapp_acceptance_start | 启动任务，立即返回 jobId |
| weapp_acceptance_status | 查询状态和源码新鲜度 |
| weapp_acceptance_cancel | 取消当前服务拥有的任务 |
| weapp_acceptance_report | 完整报告，或通过 artifact 参数读取报告中列出的图片和日志 |

把随包分发的 Skill 安装到你选择的新目录：

```bash
weapp-agent skill .agents/skills/weapp-acceptance
```

目标已存在会拒绝覆盖。Skill 指导宿主使用同一验收流程，也可以退回 CLI。核心协议基于 MCP SDK 测试；具体宿主的真实接入记录以仓库 VALIDATION.md 为准，不等同于已被官方收录。

## 报告与恢复

`accept --json` 返回 version 2。只有 passed 为 true 且 snapshot.stale 为 false 才能宣称该 requiredChecks 范围通过。build-only 配置不能代表微信运行验证。旧 verify 保持原有“已有检查无失败”语义，不作为完整验收结论。

报告包含 jobId、工程路径、检查、逐步意图与结果、截图/日志清单、起止时间以及前后源码摘要。读取 `weapp-agent report JOB_ID --json` 时重新检查当前源码，旧证据可能变为过期。源码摘要覆盖工程文件，排除依赖、构建输出、artifacts、缓存和敏感文件；不支持源码符号链接。它不是操作系统沙箱，也不覆盖远端数据变化。

状态包括 running、passed、failed、unverified、action_required、cancelled、timed_out、interrupted。同一项目只允许一个验收任务。退出后保留报告；重启只读取部分记录，不重放交互。取消需通过启动该任务的服务或终端 Ctrl-C，不能撤销已发生的交互。

证据保存在本机 Weapp Agent 状态目录的 acceptance 子目录。MCP 可读取列出的截图和日志，报告文本会脱敏。截图可能含业务数据，运行时应使用测试账号。截图是视觉检查材料，不能自动证明视觉正确；wechat-devtools 代表微信开发者工具模拟器，不能代表真机测试。

## 三个演示流程

1. 正常验收：页面中提供 count 和 increment 元素，运行计数器场景，检查断言、截图与日志。
2. 失败修复：在隔离示例中令按钮不再更新计数，运行同一场景取得失败步骤；修复实现后重新运行，保留两份报告。
3. 环境缺失：关闭测试环境连接或使用未信任项目，检查失败/待处理状态及下一步操作，确认没有误报成功。

## 兼容边界

首版面向微信上的 weapp-vite 原生与 Wevu。Taro、uni-app、传统原生项目以及其他小程序平台不在验收承诺中。动态 Vite 路径配置会产生推断警告，应先核对工程信息。上传、发布、提审及自动修改宿主设置不属于此服务。
