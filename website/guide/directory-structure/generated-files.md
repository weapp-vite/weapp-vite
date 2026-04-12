---
title: 类型声明文件
description: weapp-vite 自动生成的类型与支持文件，默认输出到 .weapp-vite 目录。
keywords:
  - .weapp-vite
  - 类型声明
  - 自动生成文件
  - 目录结构
---

# 类型声明文件

这一组文件默认都生成到 `.weapp-vite/` 下，配合 `weapp-vite` 托管的 TypeScript 支持文件一起接入编辑器与类型检查。

## 包含哪些文件

- `typed-router.d.ts`
- `typed-components.d.ts`
- `components.d.ts`
- `wevu-layouts.d.ts`

## `typed-router.d.ts`

这是 `weapp.autoRoutes` 生成的类型文件。

- 提供页面路径联合类型
- 增强 `weapp-vite/auto-routes` 的类型补全
- 增强 `wevu/router` 的路径约束

当自动路由开启，并且 `typedRouter` 没被关闭时，它会出现。

## `typed-components.d.ts`

这是自动导入组件生成的组件 props 类型文件。

- 负责组件 props 类型推断
- 增强自动导入组件相关的类型补全

当 `weapp.autoImportComponents.typedComponents` 开启时，它会出现。

## `components.d.ts`

这是 Vue 全局组件类型声明文件。

- 负责模板中的全局组件类型提示
- 配合自动导入组件一起工作
- 会在可推断场景下合并小程序组件通用基础属性（如 `class`、`style`、`id`）

当 `weapp.autoImportComponents.vueComponents` 开启时，它会出现。

## `wevu-layouts.d.ts`

这是 layout 扫描生成的类型增强文件。

- 为 `wevu` 的 `WevuPageLayoutMap` 注入 layout 名称与 props 类型
- 让 `setPageLayout()`、`usePageLayout()` 拿到更严格的类型提示

当项目里存在 `srcRoot/layouts/**` 且自动导入组件相关输出开启时，它会自动刷新。

## 默认位置

```text
.weapp-vite/typed-router.d.ts
.weapp-vite/typed-components.d.ts
.weapp-vite/components.d.ts
.weapp-vite/wevu-layouts.d.ts
```

## 相关文档

- [自动路由](/guide/auto-routes)
- [自动导入组件](/guide/auto-import)
- [TypeScript 支持文件](/config/typescript)
- [Route Rules 与 Layout](/config/route-rules)
