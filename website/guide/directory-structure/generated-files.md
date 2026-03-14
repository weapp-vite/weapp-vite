---
title: 类型声明文件
description: 自动路由和自动导入组件生成的类型声明文件，默认输出到 srcRoot 下。
---

# 类型声明文件

这一组文件默认都生成到 `srcRoot` 下，方便直接被项目的 `tsconfig` 覆盖到。

## 包含哪些文件

- `typed-router.d.ts`
- `typed-components.d.ts`
- `components.d.ts`

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

当 `weapp.autoImportComponents.vueComponents` 开启时，它会出现。

## 默认位置

```text
<srcRoot>/typed-router.d.ts
<srcRoot>/typed-components.d.ts
<srcRoot>/components.d.ts
```

## 相关文档

- [自动路由](/guide/auto-routes)
- [自动导入组件](/guide/auto-import)
