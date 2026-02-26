---
title: "@wevu/compiler"
description: "@wevu/compiler 是 Wevu 的编译能力底座，提供 Vue SFC 与小程序模板的解析、转换和输出能力。"
keywords:
  - Weapp-vite
  - Wevu
  - 编译
  - packages
  - compiler
  - "@wevu/compiler"
  - 是
  - 的编译能力底座
---

# @wevu/compiler

`@wevu/compiler` 是 Wevu 的编译能力底座，提供 Vue SFC 与小程序模板的解析、转换和输出能力。

## 何时使用

- 你要在非 Vite 场景复用 Wevu 编译链路
- 你要独立处理 SFC 的 script/template/style/config
- 你要在构建阶段做页面特性分析与注入

## 安装

```bash
pnpm add @wevu/compiler
```

## 最小示例：编译 SFC

```ts
import { compileSfc } from '@wevu/compiler'

const result = await compileSfc(sourceCode, 'pages/index/index.vue', {
  isPage: true,
  json: { kind: 'page' },
})

console.log(result.script)
console.log(result.template)
console.log(result.style)
```

## 常用导出

- `compileSfc` / `compileVueFile`
- `compileTemplate` / `compileStyle`
- `collectWevuPageFeatureFlags`
- `injectWevuPageFeaturesInJs`

## 与 Weapp-vite 的关系

`weapp-vite` 在上层整合构建流程，`@wevu/compiler` 提供底层编译能力。若你只是常规业务开发，优先看 [Weapp-vite 指引](/guide/)。
