---
title: <srcRoot>
description: Weapp-vite 的源码根目录概念，所有 pages、components、分包、自动生成类型文件都基于它定位。
keywords:
  - srcRoot
  - 源码根目录
  - weapp-vite
  - 目录结构
---

# `<srcRoot>/`

`<srcRoot>/` 是这组目录文档里最重要的概念。
`weapp-vite` 真正依赖的是 `weapp.srcRoot`，不是某个固定叫 `src/` 的文件夹。

## 默认值

大多数模板会把它设成：

```ts
export default defineConfig({
  weapp: {
    srcRoot: 'src',
  },
})
```

但你也可以改成：

```ts
export default defineConfig({
  weapp: {
    srcRoot: 'miniprogram',
  },
})
```

## 它会影响什么

- `pages/` 的扫描根目录
- `components/` 的扫描根目录
- `layouts/` 的扫描根目录
- `custom-tab-bar/`、`app-bar/` 的固定位置
- `.weapp-vite/typed-router.d.ts`、`.weapp-vite/typed-components.d.ts`、`.weapp-vite/components.d.ts` 的生成时机与引用方式

## 一个简单判断

如果某条文档写的是 `<srcRoot>/pages/**`，你应该先自动在脑中把它理解为：

`<srcRoot>/pages/**`
