---
title: VS Code 扩展
description: 为 weapp-vite 项目安装官方 VS Code 扩展，获得命令入口、页面树、生成器、路由维护、配置提示与 WXML 编辑器增强。
keywords:
  - Weapp-vite
  - guide
  - vscode
  - extension
  - VS Code 扩展
  - 编辑器增强
---

# VS Code 扩展

如果你使用 VS Code 开发 `weapp-vite` 项目，建议同时安装扩展市场里的 `weapp-vite` 扩展。它把常用 CLI、页面维护、配置提示和 WXML 编辑器增强直接放进编辑器里，减少在终端、资源管理器、`app.json` 和页面文件之间来回切换。

## 安装

1. 打开 VS Code 扩展市场，搜索 `weapp-vite` 并安装。
2. 用 VS Code 打开你的 `weapp-vite` 项目。
3. 等工作区识别完成后，打开命令面板并执行 `weapp-vite: Run Action`，确认扩展已经生效。

> [!TIP]
> 如果你使用 Vue SFC，建议同时安装 `Vue - Official (Volar)`，并结合 [@weapp-vite/volar](/packages/volar) 或 [Vue SFC 开发](/guide/vue-sfc/) 文档配置 `weapp-vite/volar`。`weapp-vite` 扩展负责编辑器入口与轻量增强，Volar 负责更完整的 Vue 类型与模板语言服务。

## 主要能力

| 能力                   | 说明                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 项目命令入口           | 在状态栏和命令面板中直接执行 `Dev`、`Build`、`Generate`、`Open DevTools`、`Doctor / Info`、`Show Output` 等常用动作。                             |
| 页面与组件生成         | 支持直接生成页面或组件骨架，也支持从资源管理器右键目录快速创建。                                                                                  |
| `app.json` 页面维护    | 支持把当前页面加入 `app.json`、从 route 直接打开页面、根据 route 创建缺失页面、同步未注册页面。                                                   |
| Pages 侧边栏           | 提供 `weapp-vite Pages` 视图，按顶层页面、分包页面、未声明页面分组查看，并支持过滤当前页面或问题页面。                                            |
| Route 导航与定位       | 支持复制当前页面 route、在 `app.json` 中定位当前页面声明、在页面树中高亮当前页面。                                                                |
| 配置补全与提示         | 为 `package.json`、`app.json`、`vite.config.*` / `weapp-vite.config.*`、页面 `definePageJson(...)` 与 `.vue` 中的配置块提供补全、悬浮和轻量诊断。 |
| WXML 编辑器增强        | 在 `.wxml` 和 weapp-vite 页面/组件的 `.vue <template>` 中提供补全、悬浮、跳转、引用、重命名和模板装饰提示。                                       |
| `usingComponents` 治理 | 支持本地组件路径校验、缺失组件提示、跳转到组件定义，以及按需生成缺失组件。                                                                        |
| 语法高亮与片段         | 提供 `.vue` 里的 `<json>` 自定义块高亮、WXML 语法支持、常用代码片段与可选文件图标主题。                                                           |

## 常用场景

### 新建页面

1. 执行 `weapp-vite: Generate`。
2. 选择创建页面。
3. 选择目标目录。
4. 按提示决定是否同步加入 `app.json`。

### 修复页面声明缺失

1. 打开页面文件。
2. 执行 `weapp-vite: Add Current Page To app.json`。
3. 或者在 `weapp-vite Pages` 视图中对未声明页面执行修复动作。

### 从 route 跳回源码

1. 在 `app.json` 中把光标放到页面 route 上。
2. 使用 `Cmd/Ctrl + Click`，或执行 `weapp-vite: Open Page From Route`。
3. 扩展会直接跳转到对应页面文件。

## 常见说明

- `weapp-vite` 扩展主要负责编辑器工作流、轻量提示和页面治理；如果你需要更完整的 Vue SFC 类型与模板能力，请配合 `Vue - Official (Volar)` 使用。
- 如果没有识别到项目，请先确认工作区里存在 `package.json`、`vite.config.*` / `weapp-vite.config.*`，以及 `app.json` 或 `src/app.json`。
- 如果你更习惯完整命令名，可以关闭配置项 `weapp-vite.preferWvAlias`，让扩展优先生成 `weapp-vite dev` 这类命令，而不是 `wv dev`。

## 相关文档

- [快速开始](/guide/)
- [CLI](/guide/cli)
- [JSON 智能提示](/guide/json-intelli-sense)
- [Vue SFC 开发](/guide/vue-sfc/)
- [@weapp-vite/volar](/packages/volar)
