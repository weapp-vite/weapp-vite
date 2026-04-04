---
name: weapp-devtools-e2e-best-practices
description: 面向采用 weapp-vite monorepo 布局仓库的 WeChat DevTools runtime e2e 工作流。适用于 `e2e/ide/**`、`miniprogram-automator`、真实运行时页面断言、共享 automator 启动、`miniProgram.reLaunch(...)` 串联、`project.private.config.json` 条件页维护，以及和 `weapp-vite screenshot/compare/ide logs` 配合形成真实运行时验收链路。
---

# weapp-devtools-e2e-best-practices

## 目的

统一 WeChat DevTools runtime e2e 的写法和验证顺序，避免重复启动 automator、脆弱导航和不稳定的 IDE 自动化。

## 触发信号

- 用户要新增或修改 `e2e/ide/**`。
- 用户要用 `miniprogram-automator` 做真实运行时断言。
- 用户问 `launchAutomator` 该怎么复用。
- 用户问是否该用 `miniProgram.reLaunch(...)`。
- 用户要把 e2e 和 screenshot / compare / logs 串成验收链路。

## 适用边界

本 skill 聚焦 DevTools runtime e2e。

以下情况不应作为主 skill：

- 主要是 CLI 设计和命令分发。使用 `weapp-ide-cli-best-practices`。
- 主要是构建配置。使用 `weapp-vite-best-practices`。
- 主要是 `wevu` 运行时语义。使用 `wevu-best-practices`。

## 快速开始

1. 先确认是否真的需要 IDE 级真实运行时验证。
2. 同一个 `e2e-app` 在同一 suite 只启动一次 automator。
3. 多场景优先通过 `miniProgram.reLaunch(...)` 切换。
4. 页面新增时同步条件页和真实 AppID。
5. 先把路由和页面稳定，再接截图 / compare。

## 执行流程

1. 检查环境前提

- WeChat DevTools 已登录。
- 服务端口已开启。
- 目标 app 使用真实 AppID。

2. 设计 suite 结构

- 在 `describe` 级别共享 automator 会话。
- 同一 `e2e-app` 不要在多个 `it` 里重复 `launchAutomator()`。
- 若必须隔离启动，在注释里说明原因。

3. 设计导航与切换

- 多场景验证优先 `miniProgram.reLaunch(route)`。
- 不要为了切页面反复重启 DevTools。
- 对 warmup、空白态、重试统一复用仓库已有工具。

4. 断言策略

- 优先做稳定的页面级/结构级断言。
- 需要 runtime 错误收集时，接入统一收集器。
- 若最终要做 AI 截图验收，先确保 e2e 路由和页面稳定，再补：
  - `wv screenshot --json`
  - `wv compare --json`
  - `wv ide logs --open`

5. 维护 `e2e-apps/*`

- 新增页面时同步：
  - `project.private.config.json` 的 `condition.miniprogram.list`
  - `project.config.json` 的真实 AppID

6. 验证顺序

- 先跑共享启动检查：
  - `node --import tsx scripts/check-e2e-ide-shared-launch.ts`
- 再跑目标 IDE e2e 文件。
- 需要视觉回归时，再补 screenshot / compare。

## 约束

- 不要在同一 `e2e-app` 重复启动 automator。
- 不要为切页面反复重启 DevTools。
- 不要在路由不稳定时先做截图对比。
- 不要把环境问题误判成业务回归。

## 输出要求

应用本 skill 时，输出必须包含：

- suite 结构。
- 页面切换方案。
- `e2e-app` 配置同步项。
- 最小验证命令。

## 完成检查

- automator 启动已复用。
- 多场景通过 `reLaunch` 串联。
- 条件页和 AppID 已同步。
- 已跑共享启动检查和目标 IDE e2e。

## 参考资料

- `references/runtime-e2e-checklist.md`
