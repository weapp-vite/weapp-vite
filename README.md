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

<p align="center"><strong>给小程序现代化的开发体验</strong></p>
<p align="center"><a href="https://vite.icebreaker.top">中文文档</a> · <a href="./README.en-US.md">English README</a></p>

`weapp-vite` 面向正在维护小程序的团队：既保留原生小程序的目录、语法和平台能力，又把 TypeScript、Vite/Rolldown、Vue SFC、自动化调试和 AI 协作带进日常研发。你可以从一个新模板开始，也可以把已有项目渐进接入进来。

## 目录

- [为什么选择 weapp-vite](#为什么选择-weapp-vite)
- [特性亮点](#特性亮点)
- [快速开始](#快速开始)
- [仓库结构](#仓库结构)
- [核心包](#核心包)
- [文档](#文档)
- [参与贡献](#参与贡献)
- [贡献者](#贡献者)
- [Star History](#star-history)
- [许可证](#许可证)

## 为什么选择 weapp-vite

- **不必推翻现有小程序**：可以继续写原生 `Page` / `Component`、WXML、WXSS 和 JSON 配置；存量项目也能按目录迁移、配置补齐、依赖安装的方式渐进接入。
- **把日常开发效率补齐**：TypeScript、ESM、Sass/Less、PostCSS、Tailwind CSS、JSONC、路径别名和 Vite 插件生态可以直接进入小程序工程，不再靠零散脚本拼维护体验。
- **减少小程序工程的重复劳动**：自动构建 `miniprogram_npm`、分包依赖分析、自动导入组件、自动路由、布局、生成页面/组件等能力，适合页面多、分包多、组件多的项目。
- **保留原生能力，同时可逐步升级写法**：团队可以先用 `weapp-vite + 原生` 稳定构建链路，再在新页面或局部模块中引入 Vue SFC 与 Wevu，而不是一次性重写业务。
- **更适合真实小程序调试和验收**：`wv dev --open`、DevTools 配置预热、日志桥接、截图、截图对比、`preview/upload` 透传和 `analyze` 能覆盖从开发到上传前检查的常见链路。
- **让 AI 协作落到真实运行时**：脚手架会生成 `AGENTS.md`，并可接入 MCP、DevTools 日志、运行时截图和截图对比，让 AI 不只改代码，还能按小程序环境做验证。

## 特性亮点

- 新项目：用 [`create-weapp-vite`](packages/create-weapp-vite) 选择原生、Wevu、Tailwind CSS、TDesign、Vant、插件或组件库模板，并自动对齐依赖组合。
- 存量项目：通过手动集成或 `wv init` 接入现有小程序，保留原有页面结构和平台能力。
- Vue SFC：在小程序里使用 `.vue`、`<script setup>`、JSON 宏、class/style 绑定和 Wevu 响应式运行时。
- 工程体验：支持构建、开发监听、HMR、组件自动导入、自动路由、分包策略、npm 构建和产物分析。
- IDE 与验收：集成 WeChat DevTools 打开、日志、截图、截图对比、预览和上传等工作流。
- AI 友好：提供 MCP、packaged docs、skills 指引和面向真实小程序运行时的检查入口。

## 快速开始

### 创建新项目

```bash
pnpm create weapp-vite
```

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

- 中文文档：<https://vite.icebreaker.top>
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
