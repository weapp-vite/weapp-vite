# create-weapp-vite

## 简介

`create-weapp-vite` 是 weapp-vite 的官方脚手架，用于快速创建小程序项目。它提供交互式模板选择，也支持命令行参数方式使用；同时导出可编程 API 方便二次封装。

## 特性

- 交互式创建或非交互式参数创建
- 内置多种模板（默认、Wevu、Tailwindcss、TDesign、Vant 等）
- 自动对齐 `weapp-vite` 与 `wevu` 版本
- 自动处理 `.gitignore` 写入
- 可选安装推荐的 AI skills（`sonofmagic/skills`）

## 安装

推荐直接使用包管理器的 create 命令：

> 说明：推荐使用 `Node.js 22+`，再执行 `pnpm create weapp-vite`、`yarn create weapp-vite` 或 `npm create weapp-vite@latest`。

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

交互流程会默认询问是否安装推荐的 AI skills，并提示将执行：

```bash
npx skills add sonofmagic/skills
```

如果你暂时不想安装，也可以先跳过，后面再手动执行上面的命令。

非交互式创建：

```bash
pnpm create weapp-vite my-app wevu

# 显式安装推荐 skills
pnpm create weapp-vite my-app wevu --install-skills

# 显式跳过推荐 skills 安装
pnpm create weapp-vite my-app wevu --no-install-skills
```

在代码中使用：

```ts
import { createProject, TemplateName } from 'create-weapp-vite'

await createProject('my-app', TemplateName.wevu)
await createProject('my-app', TemplateName.wevu, { installSkills: true })
```

## 配置

`TemplateName` 支持以下模板：

- `default`
- `wevu`
- `tailwindcss`
- `vant`
- `tdesign`
- `wevu-tdesign`

## 相关链接

- weapp-vite 文档：https://vite.icebreaker.top/
- 仓库：https://github.com/weapp-vite/weapp-vite
