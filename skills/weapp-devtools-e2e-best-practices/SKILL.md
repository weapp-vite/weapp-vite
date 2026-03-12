---
name: weapp-devtools-e2e-best-practices
description: WeChat DevTools runtime e2e playbook for repositories using the weapp-vite monorepo layout. Use this whenever the task involves `e2e/ide/**`, `miniprogram-automator`, DevTools service port checks, runtime WXML assertions, shared automator launch, `miniProgram.reLaunch(...)` sequencing, or maintaining `e2e-apps/*` DevTools project configs. Trigger on requests like "补 IDE e2e", "automator 用例怎么写", "DevTools runtime 验证", "为什么要复用 launchAutomator", "project.private.config.json 条件页怎么同步", or "这个用例要不要 reLaunch".
---

# weapp-devtools-e2e-best-practices

## Purpose

统一 WeChat DevTools runtime e2e 的写法和验证顺序，避免重复启动 automator、脆弱导航、错误的项目配置，以及无法稳定复现的 IDE 自动化测试。

## Trigger Signals

- 用户要新增或修改 `e2e/ide/**` 测试。
- 用户要使用 `miniprogram-automator` 做真实运行时断言。
- 用户问 `launchAutomator` 应该如何复用。
- 用户问 `miniProgram.reLaunch(...)` 的推荐策略。
- 用户要在 `e2e-apps/*` 增加页面，并同步 DevTools 调试入口。
- 用户遇到 DevTools 服务端口、登录、warmup、runtime snapshot 相关问题。

## Scope Boundary

本 skill 聚焦 WeChat DevTools runtime e2e。

以下情况不应作为主 skill：

- 主要是 `weapp-ide-cli` 命令设计或 automator 子命令透传。使用 `weapp-ide-cli-best-practices`。
- 主要是 GitHub issue 修复整体流程。使用 `github-issue-fix-workflow`。
- 主要是项目架构、分包、构建编排。使用 `weapp-vite-best-practices`。
- 主要是 `wevu` 生命周期、运行时语义。使用 `wevu-best-practices`。

## Quick Start

1. 先确认是否真的需要 `e2e/ide/**` 级别的真实运行时验证。
2. 同一个 `e2e-app` 在同一 suite 只启动一次 automator。
3. 多页面/多场景优先通过 `miniProgram.reLaunch(...)` 切换，不重复拉起 DevTools。
4. 更新 `e2e-apps/*` 页面时，同步维护 `project.private.config.json` 条件页和真实 AppID。

## Execution Protocol

1. 先检查环境前提

- WeChat DevTools 已登录。
- 已开启服务端口。
- 目标 app 的 `project.config.json` 使用真实 AppID，不要用 `touristappid`。

2. 设计 suite 结构

- 对同一个 `e2e-app`，在 `describe` 级别共享 automator 会话。
- 使用 `launchAutomator()` 只拉起一次，再在多个 `it` 中复用 `miniProgram`。
- 如果必须隔离启动，必须在注释里说明原因。

3. 设计导航与页面切换

- 多场景验证优先使用 `miniProgram.reLaunch(route)`。
- 不要为每个页面单独重新启动 DevTools。
- 需要处理瞬时空白、warmup 或重试时，复用仓库里的 automator 工具与兜底逻辑。

4. 断言策略

- 优先做稳定的页面级/结构级断言，避免脆弱的瞬时状态依赖。
- 需要 runtime 错误收集时，接入统一的 runtime error 收集器。
- 更新行为变更时，同步更新 snapshot/assertion。

5. e2e app 维护规则

- 新增页面时：
  - 更新 `project.private.config.json` 的 `condition.miniprogram.list`
  - 确保 `project.config.json` 继续使用真实 AppID
- 不要让 IDE 调试入口与实际页面结构脱节。

6. 验证与守护

- 优先运行目标 IDE e2e 文件，而不是整套全量 e2e。
- 修改 `e2e/ide/**` 后，优先跑共享启动约束检查：
  - `node --import tsx scripts/check-e2e-ide-shared-launch.ts`
- 再跑目标 `vitest` 用例。

## Guardrails

- 不要在同一 `e2e-app` 的多个 `it/test` 回调里重复调用 `launchAutomator()`。
- 不要为了切换页面反复重启 DevTools。
- 不要新增页面却漏掉 `project.private.config.json` 条件页。
- 不要把环境错误（未登录、端口未开）误判成业务回归。
- 不要默认上来跑所有 IDE e2e。

## Output Contract

应用本 skill 时，输出必须包含：

- suite 结构设计（共享启动还是隔离启动）。
- `reLaunch` 路由切换方案。
- 相关 `e2e-app` 配置同步项。
- 最小验证命令。

## Completion Checklist

- 同一 `e2e-app` 的 automator 启动已复用。
- 多场景验证通过 `miniProgram.reLaunch(...)` 串联。
- snapshot/assertion 已随行为变更同步。
- `project.config.json` 保持真实 AppID。
- 新增页面时 `project.private.config.json` 条件页已更新。
- 已运行共享启动检查和目标 IDE e2e。

## References

- `references/runtime-e2e-checklist.md`
