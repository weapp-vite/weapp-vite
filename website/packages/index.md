---
title: 周边包总览
description: weapp-vite 不只是一个构建器，packages 下还提供脚手架、IDE CLI、MCP、跨端 API、Web 运行时、Volar 与编译底座等能力。
keywords:
  - packages
  - 周边包总览
  - Weapp-vite
  - weapp-ide-cli
  - MCP
  - web
  - volar
---

# 周边包总览

`weapp-vite` 不只是一个构建器。围绕“创建项目、开发构建、IDE 自动化、运行时、AI 协作、编辑器提示”这条链路，仓库里的多个包会一起工作。

做技术选型时，建议先看本页，再按需进入对应子页面。

## 选型建议（先看这个）

- 新建项目：优先用 `create-weapp-vite`
- 在 CI/脚本里调用微信开发者工具：用 `weapp-ide-cli`
- 想把 DevTools 里的小程序日志桥接回 AI 终端：优先用 `weapp-vite ide logs`，底层能力由 `weapp-ide-cli` 提供
- 想让 AI 助手直接理解并操作仓库：用 `@weapp-vite/mcp`，或直接执行 `weapp-vite mcp`
- 需要“打包后执行配置文件”：用 `rolldown-require`
- 想追踪 Vite 插件耗时瓶颈：用 `vite-plugin-performance`
- 想在非 Vite 场景复用 Wevu 编译能力：用 `@wevu/compiler`
- 想统一多端小程序 API 调用风格：用 `@wevu/api`
- 想在浏览器里做小程序语法预览、调试与兼容验证：用 `@weapp-vite/web`（实验）
- 想增强 `<json>` 配置块智能提示：用 `@weapp-vite/volar`

## 包能力矩阵

| 包名                      | 定位                                     | 适用场景                       | 文档入口                                                                   |
| ------------------------- | ---------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `create-weapp-vite`       | 官方脚手架                               | 快速创建模板项目、统一模板版本 | [/packages/create-weapp-vite](/packages/create-weapp-vite)                 |
| `weapp-ide-cli`           | 微信开发者工具 CLI 增强封装              | 本地自动化、CI 预览/上传       | [/packages/weapp-ide-cli](/packages/weapp-ide-cli)                         |
| `rolldown-require`        | 以 Rolldown 为核心的 bundle+require 工具 | 加载 TS/MJS/CJS 配置文件       | [/packages/rolldown-require/index.zh](/packages/rolldown-require/index.zh) |
| `vite-plugin-performance` | Vite 插件 Hook 耗时分析                  | 定位构建慢点、插件调优         | [/packages/vite-plugin-performance](/packages/vite-plugin-performance)     |
| `@wevu/compiler`          | Wevu 编译能力底座                        | 复用 SFC/模板编译管线          | [/packages/wevu-compiler](/packages/wevu-compiler)                         |
| `@wevu/api`               | 跨平台小程序 API 封装                    | Promise 风格统一调用           | [/packages/weapi/](/packages/weapi/)                                       |
| `@weapp-vite/web`         | Web 端实验运行时与插件                   | 浏览器侧验证小程序语法/页面    | [/packages/web](/packages/web)                                             |
| `@weapp-vite/mcp`         | MCP 服务实现                             | AI 代码助手接入与仓库能力开放  | [/packages/mcp](/packages/mcp)                                             |
| `@weapp-vite/volar`       | Volar 语言插件                           | `<json>` 配置块补全与校验      | [/packages/volar](/packages/volar)                                         |

## 已有独立文档模块

- `weapp-vite` 主包：见 [指引](/guide/) 与 [配置](/config/)
- `wevu` 运行时：见 [Wevu 专区](/wevu/)
- 学习路线与整套心智模型：见 [教程](/handbook/)

## 说明

- `rolldown-require-bench` 主要用于基准测试，不建议直接作为业务依赖。
- `@weapp-vite/web` 仍偏实验用途，适合技术验证、浏览器预览与 Web 侧调试。
- `@weapp-vite/mcp` 已被 `weapp-vite` CLI 集成，通常直接使用 `weapp-vite mcp` 即可。
