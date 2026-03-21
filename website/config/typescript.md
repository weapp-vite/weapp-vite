---
title: TypeScript 支持文件
description: weapp-vite 会生成 .weapp-vite 下的托管 tsconfig 与类型文件，用于让旧项目平滑迁移并稳定接入编辑器提示。
keywords:
  - 配置
  - config
  - typescript
  - tsconfig
  - .weapp-vite
  - typed-router
  - typed-components
---

# TypeScript 支持文件 {#typescript-support}

`weapp-vite` 当前会在项目根目录下生成一组 `.weapp-vite/*` 支持文件，用来承接两类需求：

- 给 `autoRoutes`、`autoImportComponents`、layout 类型增强等能力提供稳定输出位置
- 让新项目和旧项目都能逐步接入托管的 TypeScript 配置，而不是强依赖用户手写引用结构

[[toc]]

## 会生成什么

常见输出包括：

- `.weapp-vite/tsconfig.app.json`
- `.weapp-vite/tsconfig.server.json`
- `.weapp-vite/tsconfig.node.json`
- `.weapp-vite/tsconfig.shared.json`
- `.weapp-vite/typed-router.d.ts`
- `.weapp-vite/typed-components.d.ts`
- `.weapp-vite/components.d.ts`
- `.weapp-vite/wevu-layouts.d.ts`

其中前四个是托管 `tsconfig`，后四个是由自动路由、自动导入组件、layout 扫描生成的类型文件。

## 什么时候生成

- 执行 `weapp-vite dev`
- 执行 `weapp-vite build`
- 执行 `weapp-vite open`
- 执行 `weapp-vite analyze`
- 手动执行 `weapp-vite prepare`

如果你想在编辑器启动前或 CI 里先把支持文件预热出来，推荐显式执行：

```bash
weapp-vite prepare
```

## 对旧项目的兼容策略

`weapp-vite` 不会要求所有旧项目必须立刻把根 `tsconfig.json` 改成固定的 `references` 结构，才允许项目运行。

也就是说，即使用户当前的 `tsconfig.json` 还不是下面这种形式：

```json
{
  "references": [
    { "path": "./.weapp-vite/tsconfig.app.json" },
    { "path": "./.weapp-vite/tsconfig.server.json" },
    { "path": "./.weapp-vite/tsconfig.node.json" },
    { "path": "./.weapp-vite/tsconfig.shared.json" }
  ],
  "files": []
}
```

在 `.weapp-vite` 尚未生成时，也不应该因此直接导致项目报错。当前设计更偏向“渐进迁移”：

- 新项目可以直接采用托管 `references`
- 旧项目可以先跑起来，再逐步切换到托管结构

## `weapp.typescript`

你可以通过 `weapp.typescript` 定制托管 `tsconfig` 的部分内容。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    typescript: {
      shared: {
        compilerOptions: {
          strict: true,
        },
      },
      app: {
        include: ['src/**/*', '.weapp-vite/**/*.d.ts'],
      },
      node: {
        compilerOptions: {
          types: ['node'],
        },
      },
    },
  },
})
```

支持的分组：

- `shared`：共享基础配置
- `app`：业务源码与页面/组件侧配置
- `node`：Node 脚本、配置文件相关配置
- `server`：服务端辅助入口相关配置

每组都支持：

- `compilerOptions`
- `include`
- `exclude`
- `files`

## 推荐迁移方式

1. 先让项目正常运行，并执行一次 `weapp-vite prepare`
2. 确认 `.weapp-vite/*.json` 与类型文件都已生成
3. 再决定是否把根 `tsconfig.json` 收敛到托管 `references`
4. 最后按需在 `weapp.typescript` 里补团队自己的 `compilerOptions/include/exclude`

## 相关文档

- [CLI 命令参考](/guide/cli)
- [共享配置](/config/shared)
- [类型声明文件](/guide/directory-structure/generated-files)
