---
title: vite.config.ts
description: Weapp-vite 配置入口文件，负责定义 srcRoot、自动路由、分包、自动导入组件等行为。
keywords:
  - vite.config.ts
  - weapp-vite.config.ts
  - weapp 配置
  - 自动路由
  - 目录结构
---

# `vite.config.ts` / `weapp-vite.config.ts`

`vite.config.ts` 或 `weapp-vite.config.ts` 是这组目录约定的真正入口。很多“目录为什么会生效”的答案，最终都在这里。

如果两个文件同时存在，`weapp-vite` 会优先读取并合并 `weapp-vite.config.*` 中的 `weapp` 配置；如果项目只保留其中一个，也可以正常工作。

## 它决定什么

- `weapp.srcRoot`：源码根目录在哪里
- `weapp.autoRoutes`：哪些页面目录会被扫描
- `weapp.subPackages`：哪些目录被当成分包 root
- `weapp.autoImportComponents`：哪些组件目录参与自动导入

## 最小示例

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    autoImportComponents: true,
    subPackages: {
      packageA: {},
    },
  },
})
```

## 什么时候先看它

- 页面没被扫描到
- 分包页面被识别错了
- 类型文件生成到了意料之外的位置
- 你把源码目录从 `src/` 改到了 `miniprogram/`

相关文档：[srcRoot](/guide/directory-structure/src-root) / [subPackages](/guide/directory-structure/subpackages)
