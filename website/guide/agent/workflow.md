---
title: "开发与验证流程"
description: "把代码修改与验证证据串起来。"
sidebar:
  order: 4
---

## 一次任务

1. 读取项目说明和相关源码，明确根因或实现范围。
2. 用带文件哈希的编辑工具修改代码，展示差异。
3. 执行 `verify_project`，收集类型检查、构建、测试和 DevTools 结果。
4. 根据错误修复，再运行受影响的检查。
5. 报告实际通过、失败和未验证的内容。

文件编辑之后，引擎会要求模型调用验证工具，再结束任务。检查缺失时仍会明确显示 `unverified`，不会伪造运行结果。

## 配置验证命令

`init` 从项目已有的 `typecheck`、`build`、`test` 脚本生成默认配置。命令按数组参数执行，不拼接成 Shell。

```json
{
  "kind": "build",
  "command": "pnpm",
  "args": ["run", "build"],
  "timeoutMs": 120000
}
```

将该对象放到 `weapp-agent.config.json` 的 `verification` 数组中。支持 `typecheck`、`build`、`test`、`devtools` 四类。

```bash
weapp-agent verify --json
```

报告的 `passed` 表示至少一项实际检查通过且没有失败，不表示所有类别均完成。完整验收应检查每一项的 `status`。

## 微信运行时

真实运行时检查需要已登录的微信开发者工具、开启的服务端口以及项目所需的 AppID。先连接，再切换页面、读取节点、交互、截图和查看日志。一个 suite 复用同一 automator 会话，通过 `reLaunch` 切页。

通过 MCP 调用的结果会记录在工具日志中。独立 `verify` 报告只统计配置的验证命令；要将 DevTools 纳入该报告，请配置真实执行断言的 `devtools` 命令。

Web 预览、编译成功和模拟测试不能替代微信运行时验收。上传和发布始终是需要单独授权的操作。
