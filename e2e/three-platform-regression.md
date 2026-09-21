# 微信、支付宝、抖音全面回归

## 范围与准备

从最新主线建立隔离 worktree，记录基线提交、最终提交、Node/pnpm 与三端 IDE 版本。先安装锁定依赖，再完成 `pnpm build:pkgs`。

专项排除通过 `WEAPP_VITE_E2E_EXCLUDE_PROJECTS=uview-plus-compat,wot-ui-compat` 指定。值为逗号分隔的项目目录名，不接受路径或通配符；未设置时保持原有范围。变量由子进程继承，同时作用于 suite 任务、直接 Vitest 入口和 Web 项目发现。通用编译器、平台构建和运行时测试不因引用这些库而被排除。suite 报告记录排除列表，独立任务标记为 `out-of-scope`。

所有 E2E 入口互斥运行，包含 simulator browser、headless、Web、官方编译与人工 IDE 复验。执行前检查残留进程，长时间运行启用系统防休眠。`test:types` 会触发包构建，不要与单测或下游构建并行；类型验证后重建包，再执行下游验证。

## 自动化入口

以下各项依次执行，发现失败后先最小复现、修复、重建，再继续。诊断可使用 `--allow-failures`，最终验收必须严格执行。

| 层级 | 命令 |
| --- | --- |
| 类型契约 | `pnpm test:types` |
| 构建同步 | `pnpm build:pkgs` |
| 单测、规范 | `pnpm test`、`pnpm lint`，以及各 owning package 的 `typecheck` |
| 应用与模板 | `pnpm build:apps`（包含模板） |
| CI 与 HMR | `pnpm e2e:ci`，启用 `E2E_FULL_MATRIX=1` |
| 多平台产物 | `pnpm e2e:platform:build`，启用 `E2E_FULL_MATRIX=1` |
| Web | `pnpm e2e:web:build-projects`、`pnpm e2e:web`、`pnpm e2e:web:browser-smoke` |
| simulator | `pnpm --filter @mpcore/simulator test:e2e` |
| headless | `pnpm e2e:ide:headless:full`、`pnpm exec tsx e2e/scripts/run-e2e-suite.ts ide-dom-headless` |
| 微信 | `pnpm e2e:ide:full:exhaustive`，以及 suite 明确列出的人工复验项 |
| 支付宝官方编译 | `pnpm e2e:platform:runtime:alipay`、`pnpm e2e:platform:ide-build:alipay:template`、`pnpm e2e:platform:ide-build:alipay:sfc-template` |
| 抖音准备 | `pnpm e2e:platform:doctor:tt`、`pnpm e2e:platform:open:tt` |

综合构建命令如果额外包含被排除的独立 workspace 项目，使用对应包名的 pnpm/Turbo 过滤参数。保留其他公开平台原有构建回归，但本流程只要求微信、支付宝、抖音真实 IDE 运行验收。

## 真实 IDE 复验

微信使用 provider-compatible suite，共享 automator 会话，通过 `reLaunch` 切页；新增场景同步 fixture 页面条件、真实 AppID 和产物存在性断言。支付宝与抖音使用官方 IDE，缺少稳定自动化协议时通过 Computer Use 逐步操作并记录前后状态。

| 项目 | 必验行为 |
| --- | --- |
| 支付宝 demo | 原生首页、计数组件事件、SJS 文本、antd-mini 按钮、原生分包往返、Vue/wevu 状态及组件事件 |
| 抖音 demo | 原生首页、计数组件、WXS 文本、本地 npm 原生组件事件、原生分包往返、Vue/wevu 状态及组件事件 |
| 两个多端模板 | 分别在支付宝和抖音验证冷启动、平台标记、计数更新、组件渲染及事件 |
| 开发模式 | 分别修改模板、脚本和样式，检查 IDE 更新后的可见结果，随后恢复测试修改 |

每个项目记录 IDE/基础库版本、repo-relative 项目路径、路由、动作、操作前后文本或状态、控制台错误、结果与证据。router 或生命周期修复至少包含冷启动主路径及返回、abort、redirect 等相关边界，不将微信专属 React 能力推断为支付宝或抖音支持。

官方编译通过与真实运行通过分别记录；打开 IDE 本身不算运行验收。登录、端口或模拟器故障先尝试 UI 恢复，仍失败时标记环境阻塞与“未完成最终验收”。

## 结果与交付

结果区分通过、失败、用户排除、环境阻塞、未执行。修复须保留最小 fixture、根因单测和目标平台运行证据；微信与 headless 差异以真实 IDE 稳定行为为准补齐 mpcore 回归。

PR 只提交有意的源码、测试、复验清单和精简结论，不提交机器路径、登录信息或无关 IDE 改写。行为变更添加中文 changeset；涉及 weapp-vite、wevu 或模板时联动 create-weapp-vite。最终代码严格复验并跟踪全部必需 CI，存在环境阻塞时保留草稿状态。
