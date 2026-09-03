---
name: weapp-devtools-e2e-best-practices
description: 面向 weapp-vite 仓库的 WeChat DevTools 与 mpcore headless runtime e2e 工作流。适用于 `e2e/ide/**`、`miniprogram-automator`、`WEAPP_VITE_E2E_RUNTIME_PROVIDER`、全局串行、共享 automator、`miniProgram.reLaunch(...)`、DevTools/headless parity、跨平台 launcher，以及 screenshot/compare/logs 验收。
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
- 用户要让同一 provider-compatible 场景在 `devtools` 与 `headless` 运行，或修复两者的可观察差异。

## 不适用场景

本 skill 聚焦 DevTools runtime e2e。

- CLI 设计和命令分发：使用 `weapp-vite-best-practices`。
- 构建配置：使用 `weapp-vite-best-practices`。
- `wevu` 运行时语义：使用 `wevu-best-practices`。

## 核心流程

1. 先确认没有其他仓库级 e2e、DevTools、automator、watch 或本地验证服务在运行，再确认环境前提：
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
7. touched 场景优先通过 `WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools|headless` 复用；若无法直接复用，在 mpcore owning package 补 unit/integration、browser e2e，公开类型变化再补 type-contract test。
8. DevTools 与 headless 语义不一致时，以稳定可复现的真实 DevTools 行为为准，修复 mpcore，不弱化真实断言。
9. 新增 `queueMicrotask`、Web API、DOM/Node 全局或现代内建前，在未启用对应注入的原生 AppService fixture 中探测 `typeof` 和最小调用语义，并记录 DevTools、SDK、renderer 与 platform；Node、浏览器、类型声明和 headless 结果不能代替该证据。

## 环境治理与已知边界

- 仓库级 E2E 入口互斥运行；启动前先检查并清理残留 DevTools、automator、watch 和本地验证服务进程。
- OS-only 失败先输出 `cross-platform suspect: checking command launch, path normalization, line endings, and filesystem assumptions before product logic`，并检查 workflow -> script -> Node wrapper -> child process 的最早分歧。
- 跨平台进程启动优先使用 `execa`；原始 `spawn` 必须处理 Windows `.cmd`、quoting 和必要的 shell 边界。
- 长时间 IDE suite 在 macOS 使用 `caffeinate -dimsu -- ...`，避免机器休眠导致假失败。
- 若 native `fetch` 通过而 axios/graphql-request 在 DevTools 报 `URL is not a constructor` 或同类构造器错误，先做最小复现并记录为 DevTools 兼容缺陷；只 skip 受影响场景，保留 native fetch 覆盖。
- stateful HMR、plugin 输出和 MCP runtime tools 的断言优先使用路由、文本、结构化 bridge 返回值等稳定语义，不匹配压缩变量名或 hash。
- mpcore 可观察行为变化保持三层同步：package unit/integration、browser e2e、公开类型涉及时的 test-d。

## 约束

- 不要在同一 `e2e-app` 重复启动 automator。
- 不要为切页面反复重启 DevTools。
- 不要在路由不稳定时先做截图对比。
- 不要把环境问题误判成业务回归。
- 不要只跑通过的一侧 provider，也不要把路径分隔符、CRLF、驱动器或临时目录写进跨平台断言。
- 不要假定所有微信基础库都存在 `queueMicrotask`；单个 DevTools 版本探测为可用也不能替代兼容层。

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
