---
title: 什么是 Weapp-vite ?
description: Weapp-vite 是一个面向微信小程序的现代构建框架：尽量不改变你写原生小程序的方式（语法、目录结构都能沿用），但把 Vite
  生态、TypeScript、CSS 预处理器和更顺滑的开发/构建流程带进来。你仍然写小程序，但开发体验会更…
keywords:
  - Weapp-vite
  - 迁移指南
  - guide
  - what
  - is
  - weapp
  - vite
  - 什么是
---

# 什么是 Weapp-vite ?

## 核心简介

`weapp-vite` 是一个面向微信小程序的现代构建框架：尽量不改变你写原生小程序的方式（语法、目录结构都能沿用），但把 Vite 生态、TypeScript、CSS 预处理器和更顺滑的开发/构建流程带进来。你仍然写小程序，但开发体验会更接近“现代前端工程”。

## 我们想解决的问题

- 原生工具链缺少一些现代体验：模块化、自动刷新、类型提示等效率工具不够完善。
- 跨端框架虽然功能丰富，但抽象层更厚，学习/调试成本更高；并不适合想坚持原生写法的团队。
- 老项目常见的 gulp / 自研脚本维护成本高：升级依赖、接入新能力都比较费劲。

## Weapp-vite 的能力亮点

- **原生写法 0 改动**：保留微信原生语法和目录组织方式，逐步引入现代能力。
- **Vite/Rolldown 生态**：兼容 Vite 配置与插件，底层打包器 Rolldown 针对小程序场景做了分包、样式注入等优化。
- **工程化开箱即用**：默认支持 TypeScript、PostCSS、Sass/Less、Tailwind CSS、JSONC 等常用特性，并提供 `pnpm create weapp-vite` 和 `pnpm g` 等脚手架命令。
- **小程序特色增强**：自动构建 `miniprogram_npm`、智能分包依赖分析、自动组件注册、WeChat Developer Tools CLI 集成。
- **良好的调试体验**：保存即热更新、详细的构建日志、`weapp.debug` 钩子帮助排查路径解析、产物归属等问题。
- **AI 协作内建**：内置 `weapp-vite mcp`、`weapp-vite ide logs`、运行时截图与截图对比，并通过 `create-weapp-vite` 默认生成 `AGENTS.md`。

## 现在不只是构建器

在当前版本里，`weapp-vite` 更像一整条“小程序研发工具链”，常见能力可以按这几层理解：

- **项目创建**：`create-weapp-vite` 负责模板、依赖版本对齐、`AGENTS.md`、推荐 AI skills 安装。
- **开发与构建**：`weapp-vite dev/build/prepare/analyze/open` 负责工程主链路。
- **IDE 自动化**：通过 `weapp-ide-cli` 透传 `preview/upload/config/screenshot/compare` 等命令。
- **AI 协作**：通过 `weapp-vite mcp`、`take_weapp_screenshot`、`compare_weapp_screenshot`、`weapp-vite ide logs --open` 把真实项目能力暴露给 AI。
- **运行时**：`wevu` 负责响应式、生命周期、store 与最小化 `setData` 更新。

如果你把它只理解成“把原生小程序改成 Vite 构建”，就会错过当前版本很大一部分能力面。

## 什么时候适合选择 Weapp-vite

- 你想坚持原生小程序写法，同时想要现代前端工具链（TS、模块化、热更新等）。
- 团队有存量项目，想尽量不动业务代码就升级构建流程。
- 你需要深入用微信提供的底层能力（如 Skyline、Donut），对运行时兼容层比较谨慎。

## 什么时候可以考虑其他方案

- 项目需要“一套代码多端运行”，或想直接用 `Vue`/`React` 写界面：可以优先评估 `uni-app`、`taro` 等跨端框架。
- 如果你只需要很基础的构建能力，并且已经投入了其他脚手架：可以先沿用现有方案，合适的时候再迁移。

## 迁移与生态

- `weapp-vite init` 支持在现有原生项目上直接生成配置，沿用原目录结构即可。
- 构建产物完全兼容微信开发者工具，分包、插件、Worker 等官方能力都可以继续使用。
- 通过 Vite 插件体系可以快速接入 Tailwind CSS、UnoCSS、自动化测试、Rollup 插件等生态资源。

## 对 AI 更友好的地方

如果项目是通过 `create-weapp-vite` 创建的，根目录通常会附带：

- `AGENTS.md`
- `node_modules/weapp-vite/dist/docs/*.md`

这两者会告诉 AI：

- 先读当前安装版本的本地文档，而不是依赖过时网站或模型记忆
- 提到截图时优先使用 `weapp-vite screenshot`
- 提到截图对比时优先使用 `weapp-vite compare`
- 提到 DevTools 日志时优先使用 `weapp-vite ide logs --open`

这也是为什么当前文档里会反复强调 AI 工作流、MCP 与 DevTools 日志桥接。

想要快速验证效果？前往 [快速开始](/guide/) 章节，十分钟内完成首个项目的创建、运行与调试。
