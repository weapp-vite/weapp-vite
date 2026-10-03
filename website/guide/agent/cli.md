---
title: "CLI 参考"
description: 查看 weapp-agent 独立 CLI 的命令与选项，配置项目、执行任务、恢复会话并读取验收报告。
sidebar:
  order: 9
keywords:
  - weapp-agent
  - CLI
  - 命令行
  - 验收报告
---

## 命令

| 命令 | 用途 |
| --- | --- |
| `weapp-agent` | Ink 终端对话，支持进度、差异与审批 |
| `init [directory]` | 创建配置；`--create` 新建小程序 |
| `run <prompt>` | 执行单次任务 |
| `resume <session> [prompt]` | 继续会话 |
| `sessions` | 列出当前项目会话 |
| `sessions --details` | 按更新时间列出会话摘要及异常 |
| `session <id>` | 只读查看会话状态、用量与待核对调用 |
| `doctor` | 检查项目与凭据前提 |
| `verify` | 独立执行配置中的验证命令，保留旧报告语义 |
| `accept` | 无模型验收，返回 version 2 报告 |
| `report <jobId>` | 读取报告并检查源码是否变化 |
| `mcp` | 启动 stdio 验收服务 |
| `skill <directory>` | 将随包 Skill 复制到指定的新目录 |

全局参数：`-C` / `--cwd`、`--trust`、`--json`。`run` 和 `resume` 支持 `--image`。终端中按 Esc 取消当前任务，空闲时输入 `/exit` 退出。

确认已检查中断操作后，可以使用 `resume <session> --acknowledge-interrupted`，或在交互终端输入 `/acknowledge-interrupted [prompt]`。普通继续输入不会自动确认，确认也不会重放旧操作。详见[会话与中断恢复](./sessions)。

## JSON 输出

```bash
weapp-agent -C ./my-miniapp run "修复首页错误并验证" --json
```

`run` 和 `resume` 的 stdout 输出 JSONL 事件，包含 `version`、`sessionId`、`sequence`、`timestamp`、`type`、`data`。主要事件为 `run.started`、`text.delta`、`tool.started`、`tool.completed`、`usage`、`context.compacted`、`run.completed`。

启动前错误使用 `{ "version": 1, "type": "error", "data": { "message": "..." } }`；此时尚未创建会话。`doctor`、`verify`、`init` 和 `sessions` 的 JSON 模式各输出一个结果对象。

`sessions --json` 保持 ID 数组格式；`sessions --details --json` 输出摘要数组，`session <id> --json` 输出单个详情对象。详情读取无需模型凭据或项目授权，不修改会话日志。损坏项以 `invalid` 和诊断信息展示，单独查询损坏会话退出码为 1。

`run.completed` 在 `limit_reached` 时包含可选 `reason`：`max_steps` 表示步骤上限，`context_budget` 表示完整用户要求已超过上下文预算。后者在调用模型之前停止，调整预算后可恢复。事件和日志版本继续为 1。

## 退出码

| 退出码 | 含义 |
| --- | --- |
| 0 | 任务完成，或独立检查没有失败 |
| 1 | 配置、模型或验证失败 |
| 2 | 需要授权或中断状态核对 |
| 3 | 达到步骤或上下文预算上限 |
| 130 | 取消或超时 |

任务完成不等于所有检查通过，请读取验证报告里的类别状态。

`init` 的 `--model` 为可选项；独立 `run` / `resume` 仍需要模型配置。`accept` 仅在报告通过且未过期时返回 0，缺少必需证据或超时返回 1，待授权或中断核对返回 2，取消返回 130。详见[宿主接入与验收](/guide/acceptance)。
