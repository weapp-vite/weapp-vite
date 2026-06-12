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

`weapp-vite` 为传统小程序开发带来接近 Vite 的现代工程体验。这个 monorepo 包含核心构建器、运行时包、项目模板、IDE 辅助能力、MCP 支持，以及用于验证微信等小程序项目的端到端示例。

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

- 用现代工具链维护小程序应用，减少传统构建流程的限制。
- 通过官方脚手架 `create-weapp-vite` 快速创建项目。
- 在一个 workspace 内维护模板、运行时、示例应用和 e2e 回归用例。
- 内置面向 AI 协作的 MCP、IDE 辅助命令和 packaged skills 等能力。

## 特性亮点

- 官方脚手架：[`create-weapp-vite`](packages/create-weapp-vite)
- 核心构建与运行时包位于 `packages/`、`packages-runtime/` 和 `@weapp-core/`
- `apps/` 提供可运行示例，`e2e-apps/` 提供回归和 issue 复现场景
- `website/` 承载公开文档站点
- 基于 `pnpm` + `turbo` 维护 CI、HMR、IDE 和运行时验证脚本

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
