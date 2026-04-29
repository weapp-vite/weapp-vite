---
name: weapp-devtools-e2e-best-practices
description: 面向采用 weapp-vite monorepo 布局仓库的 WeChat DevTools runtime e2e 工作流。适用于 `e2e/ide/**`、`miniprogram-automator`、真实运行时页面断言、共享 automator 启动、`miniProgram.reLaunch(...)` 串联、`project.private.config.json` 条件页维护，以及和 `weapp-vite screenshot/compare/ide logs` 配合形成真实运行时验收链路。
---

# weapp-devtools-e2e-best-practices

## 用途

统一 WeChat DevTools runtime e2e 的写法和验证顺序，避免重复启动 automator、脆弱导航和不稳定的 IDE 自动化。

## 何时使用

- 用户要新增或修改 `e2e/ide/**`。
- 用户要用 `miniprogram-automator` 做真实运行时断言。
- 用户问 `launchAutomator` 该怎么复用。
- 用户问是否该用 `miniProgram.reLaunch(...)`。
- 用户要把 e2e 和 screenshot / compare / logs 串成验收链路。
- 用户要通过 MCP 的 `weapp_devtools_*` / `weapp_runtime_*` 工具检查真实运行时页面。

## 不适用场景

本 skill 聚焦 DevTools runtime e2e。

- CLI 设计和命令分发：使用 `weapp-vite-best-practices`。
- 构建配置：使用 `weapp-vite-best-practices`。
- `wevu` 运行时语义：使用 `wevu-best-practices`。

## 核心流程

1. 先确认环境前提：
   - WeChat DevTools 已登录
   - 服务端口已开启
   - 目标 app 使用真实 AppID
2. 同一个 `e2e-app` 在同一 suite 只启动一次 automator，并在 `describe` 级别共享。
3. 多场景优先用 `miniProgram.reLaunch(route)` 切换，不要为了切页反复重启 DevTools。
4. 断言优先页面级、结构级、可稳定复用的 runtime 收集器；截图验收放在路由稳定之后。
   - MCP 场景下，先用 `weapp_devtools_connect`，再用 `weapp_devtools_route` / `weapp_runtime_find_node` / `weapp_devtools_console`。
5. 新增页面时同步：
   - `project.private.config.json` 的 `condition.miniprogram.list`
   - `project.config.json` 的真实 AppID
6. 按顺序验证：
   - `node --import tsx scripts/check-e2e-ide-shared-launch.ts`
   - 目标 IDE e2e 文件
   - 需要视觉回归时再补 `wv screenshot --json`、`wv compare --json`、`wv ide logs --open`

## 约束

- 不要在同一 `e2e-app` 重复启动 automator。
- 不要为切页面反复重启 DevTools。
- 不要在路由不稳定时先做截图对比。
- 不要把环境问题误判成业务回归。

## 输出

应用本 skill 时，输出必须包含：

- suite 结构。
- 页面切换方案。
- `e2e-app` 配置同步项。
- 最小验证命令。

## 完成标记

- automator 启动已复用。
- 多场景通过 `reLaunch` 串联。
- 条件页和 AppID 已同步。
- 已跑共享启动检查和目标 IDE e2e。

## 参考资料

- `references/runtime-e2e-checklist.md`
