# create-weapp-vite

## 简介

`create-weapp-vite` 是 weapp-vite 的官方脚手架，用于快速创建小程序项目。它提供交互式模板选择，也支持命令行参数方式使用；同时导出可编程 API 方便二次封装。

## 特性

- 交互式创建或非交互式参数创建
- 内置多种模板（默认、Wevu、Tailwindcss、TDesign、Vant 等）
- 自动对齐 `weapp-vite` 与 `wevu` 版本
- 自动处理 `.gitignore` 写入

## 安装

推荐直接使用包管理器的 create 命令：

```bash
pnpm create weapp-vite
# 或
npx create-weapp-vite
```

## 使用

交互式创建：

```bash
pnpm create weapp-vite
```

非交互式创建：

```bash
pnpm create weapp-vite my-app wevu
```

在代码中使用：

```ts
import { createProject, TemplateName } from 'create-weapp-vite'

await createProject('my-app', TemplateName.wevu)
```

## 配置

`TemplateName` 支持以下模板：

- `default`
- `wevu`
- `tailwindcss`
- `vant`
- `tdesign`
- `wevu-tdesign`
- `wevu-retail`

## 相关链接

- weapp-vite 文档：https://vite.icebreaker.top/
- 仓库：https://github.com/weapp-vite/weapp-vite
