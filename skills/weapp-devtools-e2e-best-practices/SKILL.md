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

1. 先确认没有其他仓库级 e2e、automator、watch 或本地验证服务占用测试资源；保留手动打开或归属未知的 DevTools，再确认环境前提：
   - 核对官方最新稳定版、查询时间、所选安装和实际连接宿主；默认使用最新稳定版，仅按用户明确指定使用其他版本
   - 通过 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 显式选择固定位置的 Stable；入口将其传入本轮进程的 `WEAPP_IDE_CLI_PATH`，预检、公共 CLI、MCP 子调用、启动、构建和恢复共用同一安装，不改写用户全局 CLI 配置
   - 日常开发与 E2E 复用同一个已登录 Stable 宿主和一个微信账号；多个项目可以共用该宿主，账号正常过期时重新登录，不同步不同安装的登录票据
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

- 仓库级 E2E 入口通过同机、同用户、跨 worktree 的机器租约互斥运行，包含 headless、CI、直接 Vitest 和聚合脚本；项目租约、端口租约与同一 suite 的多会话仍保留。改变 `WEAPP_AGENT_STATE_DIR` 不会隔离机器租约。
- 遇到 `Runtime busy` 时由任务调度层等待持有者完成后再试，不自动抢占、删除锁或构造跳过环境变量。受控子进程只在磁盘 owner token 与 PID 活性核验通过后借用父租约；借用方仅释放自己的登记，不能释放父租约。父进程退出后仍有活子任务或归属未知时保留占用。
- 登录、启动、构建和其他宿主变更操作共用机器租约边界；普通已建立的多项目连接不会为了整个会话长期独占宿主。headless 参与互斥调度，但不应读取或更改真实 IDE 登录状态。
- 启动前检查进程，只释放本任务明确登记且仍持有的 DevTools、automator、watch 和验证服务资源。其他任务等待，手动 IDE 与归属未知的实例保留。
- 启动失败不是全局清理授权。禁止按进程名、命令行子串或 Windows 镜像名终止所有 IDE；不得删除全局 session、port-lease、登录数据和用户缓存。恢复、超时、重试与 teardown 共用幂等 disposer；不将已退出的 CLI PID 当成宿主 PID。
- 安装版本读取应用自身元数据，不能用 Electron 版本代替；连接时复核实际宿主的安装身份、监听端口归属以及 `toolInfo()` 返回的 IDE/基础库版本。显式指定端口也必须核对归属，不按其他安装最近写入的端口文件猜测目标。
- 共享连接和持久化会话必须匹配安装身份。旧记录缺少身份或目标不匹配时停止复用并诊断，保留未知归属资源；测试不得自动安装、换版、退出账号、复制凭据或清登录缓存。诊断只记录安装、版本、端口归属与登录布尔状态，不输出账号票据或租约 token。
- 每轮真实 IDE 验收前从[官方渠道](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)核对最新稳定版，不把默认安装路径、已登录状态或较大版本号当作渠道证明。报告记录查询时间、来源、实际 IDE 及基础库版本；不要长期硬编码某个版本为“最新”。
- 没有用户明确指定，不切换 RC、nightly、开发版或旧稳定版，即使当前测试失败。最新稳定版无法确认、未安装或未登录时报告阻塞，不静默回退、不绕过登录；固定性能运行仍按已批准目标执行，不重新采样。
- 清理回归至少证明：本任务资源被释放，手动实例、另一项目及另一安装版本仍保留；重复 close/recovery 只释放一次。根因与复盘见 `docs/plans/2026-09-30-devtools-process-ownership.md`。
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
- 官方稳定版核对来源及时间、实际 IDE/基础库版本、显式版本例外（如有）和资源清理范围。
- 本轮 CLI 选择、实际宿主与端口身份是否一致，以及租约是否由本任务持有、借用或因其他任务占用而等待；不记录敏感凭据。

## 完成标记

- automator 启动已复用。
- 多场景通过 `reLaunch` 串联。
- 条件页和 AppID 已同步。
- 已跑共享启动检查和目标 IDE e2e。

## 参考资料

- `references/runtime-e2e-checklist.md`
