---
title: "架构与设计取舍"
description: 了解独立 Agent、无模型验收包与 DevTools 运行适配器的边界，以及工具执行、权限和会话持久化设计。
sidebar:
  order: 10
keywords:
  - weapp-agent
  - 架构
  - 验收
  - DevTools
---

## 模块边界

CLI 负责终端交互和命令参数；core 负责会话、工具循环、权限和文件操作；providers 负责模型协议转换；mini-program 适配独立 Agent 的工程识别与工具；acceptance 负责无模型验收，运行适配器复用现有 DevTools；文档并入 weapp-vite 网站。

`ModelAdapter` 暴露异步事件流；`Tool` 声明 schema 与执行方法；`ProjectAdapter` 提供工程事实、指令和工具；`SessionEvent` 是带版本的持久化事件。

模型适配器只生成文本与工具请求，不执行工具。工具执行由 core 顺序调度，写入日志后再执行，从边界上避免网络请求重试重复执行工具。

上下文压缩独立于工具执行，完整保留真实用户要求，按完整调用组裁剪历史。会话恢复与只读详情共用日志读取器和顺序归约器：结果只完成此前对应的待处理调用，旧轮次的同名 ID 不会完成新调用。只有持有会话写锁的恢复入口才能修复尾部半行；查询入口始终只读。

## 参考项目

设计调研固定于以下源码版本；首版为独立实现，没有复制这些项目的源代码。

| 项目 | 版本 | 借鉴 |
| --- | --- | --- |
| [Codex](https://github.com/openai/codex/tree/a6f09397aa591f6ea9f02037c55c10a8cbf6f61f) | a6f09397 | 会话事件、项目指令、权限与差异追踪 |
| [OpenCode](https://github.com/anomalyco/opencode/tree/7945de208964a49300d7f770d1a71d078db9a4c4) | 7945de20 | 模型适配与执行层分离 |
| [Pi](https://github.com/earendil-works/pi/tree/1ff5b6fddf69c322c6937781a720f97e87c93774) | 1ff5b6fd | 简洁工具循环、取消和扩展接口 |

## 首版边界

采用 API Key，不实现订阅账号 OAuth。提供本地工具权限，不提供 OS 级沙箱。框架适配先聚焦微信与 weapp-vite；多平台、Web 工作台、并行子 agent 留待后续独立设计。

文件编辑使用读取哈希校验与原子替换，降低覆盖并发改动的风险；仍建议避免两个进程同时编辑同一文件。

## 宿主工具模式

@weapp-vite/acceptance 提供模型无关的 AcceptanceService，wv accept、独立 CLI accept 与现有 MCP 共用执行器。工程配置允许不包含 model，独立 run/resume 仍使用必需模型的 AgentConfig。不会在宿主内部默认启动第二个模型循环。

验收任务以项目锁串行执行，逐步持久化交互意图与结果；服务退出时取消自己拥有的任务和连接。任务不会自动重放。新报告 version 2 明确必需检查、证据来源与源码新鲜度，旧 verify 保留兼容语义。Skill 负责告诉宿主何时运行、如何读取结论，确定性的任务执行由服务实现。
