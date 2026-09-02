<p align="center">
  <img src="./website/public/logo.png" height="150" alt="weapp-vite logo">
</p>

<h1 align="center">weapp-vite</h1>

<p align="center">
  <a href="https://deepwiki.com/weapp-vite/weapp-vite"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
  <a href="https://www.npmjs.com/package/weapp-vite"><img src="https://img.shields.io/npm/v/weapp-vite?logo=npm&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/weapp-vite"><img src="https://img.shields.io/npm/dm/weapp-vite?logo=npm&label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/weapp-vite/weapp-vite/stargazers"><img src="https://img.shields.io/github/stars/weapp-vite/weapp-vite?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/weapp-vite/weapp-vite/blob/main/LICENSE"><img src="https://img.shields.io/github/license/weapp-vite/weapp-vite" alt="License"></a>
  <a href="https://github.com/weapp-vite/weapp-vite/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/weapp-vite/weapp-vite/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://atomgit.com/sonofmagic/weapp-vite"><img src="https://atomgit.com/sonofmagic/weapp-vite/star/badge.svg" alt="GitCode Star"></a>
</p>

<p align="center"><strong>AI 时代，原生小程序研发的默认基线</strong></p>
<p align="center"><a href="https://vite.weapp.dev">中文文档</a> · <a href="./README.en-US.md">English README</a></p>

`weapp-vite` 面向正在维护原生小程序的团队：保留 Page、Component、WXML、WXSS 和平台 API，同时把现代工程化、多端构建和可验证的 AI 工作流带进日常研发。它既适合从模板开始的新项目，也适合存量项目渐进接入。

## 目录

- [为什么选择默认基线](#为什么选择默认基线)
- [AI 可执行闭环](#ai-可执行闭环)
- [特性亮点](#特性亮点)
- [快速开始](#快速开始)
- [仓库结构](#仓库结构)
- [核心包](#核心包)
- [文档](#文档)
- [参与贡献](#参与贡献)
- [贡献者](#贡献者)
- [Star History](#star-history)
- [许可证](#许可证)

## 为什么选择默认基线

- **不必推翻现有小程序**：继续写原生 `Page` / `Component`、WXML、WXSS 和 JSON 配置，按目录和模块渐进接入。
- **现代工程能力成为默认行为**：TypeScript、ESM、Sass/Less、PostCSS、Tailwind CSS、JSONC、路径别名和 Vite 插件生态直接进入小程序工程。
- **一次维护，多端构建**：用单目标构建覆盖微信、支付宝、抖音、百度、京东、小红书与 Web，同时保留平台边界。
- **复杂项目有人托管**：自动构建 `miniprogram_npm`、分包依赖分析、自动导入组件、自动路由、布局和产物分析，减少重复维护。
- **真实运行时可观察、可验收**：从 `wv dev --open` 到 DevTools 日志、截图对比、`preview/upload` 和 `analyze`，开发结果有证据可追踪。

## AI 可执行闭环

weapp-vite 不把 AI 当成一个聊天入口，而是把它接到真实项目的研发链路：

```text
项目上下文（AGENTS + 本地文档）
        ↓
MCP 工具（构建 / 日志 / 截图 / 对比）
        ↓
运行时证据（页面状态、控制台、视觉 diff）
```

AI 可以基于项目约定完成修改，再通过小程序运行时检查结果。查看[AI 工作流文档](https://vite.weapp.dev/guide/ai-workflows)和[统一 AI 入口](https://vite.weapp.dev/ai)。

## 特性亮点

- 新项目：用 [`create-weapp-vite`](packages/create-weapp-vite) 选择原生、多平台 + Web、Vue SFC 多平台 + Web、Wevu、Tailwind CSS、TDesign、Vant、插件或组件库模板，并自动对齐依赖组合。
- 存量项目：通过手动集成或 `wv init` 接入现有小程序，保留原有页面结构和平台能力。
- Vue SFC：在小程序里使用 `.vue`、`<script setup>`、JSON 宏、class/style 绑定和 Wevu 响应式运行时。
- uni-app 组件库：通过 `WotUiResolver()` 或 `UviewPlusResolver()` 在微信小程序与 Web 中使用经过全组件矩阵验证的 Wot UI、uview-plus Vue SFC。
- 工程化：支持构建、开发监听、HMR、组件自动导入、自动路由、分包策略、npm 构建和产物分析。
- IDE 与验收：集成 WeChat DevTools 打开、日志、截图、截图对比、预览和上传等工作流。
- AI 可执行验证：提供 MCP、packaged docs、skills 指引和面向真实小程序运行时的检查入口。

## 快速开始

### 创建新项目

```bash
pnpm create weapp-vite
```

需要用同一份源码覆盖微信、支付宝、抖音、百度、京东、小红书与 Web 时，可以按写法选择原生或 Vue SFC 多平台模板：

```bash
# 原生 Page / Component
pnpm create weapp-vite my-app multi-platform

# Wevu + Vue SFC
pnpm create weapp-vite my-app multi-platform-sfc
```

两个模板都坚持单目标构建，具体命令、输出目录和验收边界见[多平台构建指南](https://vite.weapp.dev/guide/multi-platform)。

也可以使用：

```bash
yarn create weapp-vite
npm create weapp-vite@latest
```

### 本地开发当前仓库

```bash
pnpm install
pnpm build:pkgs
pnpm test
```

常用补充命令：

```bash
pnpm build:apps
pnpm build:templates
pnpm build:docs
```

## 仓库结构

- `packages/` 和 `packages-runtime/`：核心工具链与运行时包
- `@weapp-core/`：workspace 共享工具、常量和初始化能力
- `apps/`：示例和 playground 应用
- `templates/`：脚手架使用的项目模板
- `e2e/` 和 `e2e-apps/`：CI、真实运行时和 issue 复现覆盖
- `website/`：公开文档站点
- `docs/`：架构说明、计划和报告
- `extensions/`：编辑器和集成扩展

## 核心包

- [`weapp-vite`](packages/weapp-vite)：主要的小程序构建器
- [`create-weapp-vite`](packages/create-weapp-vite)：官方项目脚手架
- [`@weapp-vite/mcp`](packages/mcp)：MCP 相关工具
- [`weapp-ide-cli`](packages/weapp-ide-cli)：微信开发者工具工作流辅助 CLI
- [`rolldown-require`](packages/rolldown-require)：基于 Rolldown 的文件打包与 require 辅助工具

## 文档

- 中文文档：<https://vite.weapp.dev>
- 贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md)
- English README：[README.en-US.md](./README.en-US.md)

## 参与贡献

欢迎提交 issue 和 PR：

- 通过 issue 反馈 bug、功能建议或文档缺口。
- 通过 PR 提交修复、重构、文档或示例。
- 分享生产实践、中间件和生态集成经验。

贡献细节请查看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 贡献者

感谢 [所有贡献者](https://github.com/weapp-vite/weapp-vite/graphs/contributors)。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=weapp-vite/weapp-vite&type=Date)](https://star-history.com/#weapp-vite/weapp-vite&Date)

## 许可证

本项目基于 MIT License 发布，详见 [LICENSE](LICENSE)。
