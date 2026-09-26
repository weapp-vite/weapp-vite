# @wevu/compiler

## 简介

`@wevu/compiler` 提供 Wevu 的编译能力，面向小程序模板与 Vue SFC 的解析、转换与输出。它从 weapp-vite 中抽离出纯编译管线，供 `wevu/compiler` 与 weapp-vite 等上层工具复用。

## 特性

- Vue SFC 编译（script/template/style/config）
- WXML/WXSS 编译与多平台模板适配
- JSON 配置解析与合并策略
- Wevu 页面特性分析与注入
- 可作为独立编译器在非 Vite 场景使用

## 安装

```bash
pnpm add @wevu/compiler
```

## 使用

编译单个 Vue SFC：

```ts
import { compileSfc } from '@wevu/compiler'

const result = await compileSfc(
  sourceCode,
  filename,
  {
    isPage: true,
    template: { /* 模板编译参数 */ },
    json: { kind: 'page' },
  },
)

console.log(result.script)
console.log(result.template)
```

### 编译诊断

`compileTemplate` 始终返回 `diagnostics`，供调用方检查错误和警告。`compileSfc`（`compileVueFile`）遇到 error 级模板诊断或 SFC 解析错误时，会抛出公开的 `CompilerDiagnosticError`，不会返回静默降级的产物；warning 仍随成功结果返回。`compileJsxFile` 在存在 JSX 诊断时返回 `diagnostics`。每条诊断以及 `CompilerDiagnosticError` 均包含稳定的 `code`、`severity`、`message`、`filename`、`source` 和可选 `loc`。

这是一次 clean cutover：原有 `warnings: string[]` 字段已移除，调用方应改读 `diagnostics`，需要展示文本时使用 `diagnostic.message`。

```ts
import { compileTemplate } from '@wevu/compiler'

const result = compileTemplate(
  '<view v-html="html" />',
  '/project/src/pages/index.vue',
)

for (const diagnostic of result.diagnostics) {
  if (diagnostic.code === 'WV1001') {
    console.warn(diagnostic.message, diagnostic.loc)
  }
}
```

稳定 code：`WV1001`（模板转换警告）、`WV1002`（模板表达式警告）、`WV1003`（JSX 警告）、`WV2001`（模板解析错误，含非法 `v-for`）、`WV2002`（模板编译错误）、`WV2003`（SFC 解析错误）。SFC 解析错误通过 `cause` 保留原始 Vue 错误及其数值 code，不将其混入稳定的 `WV*` code。

`loc.start` / `loc.end` 使用半开区间；`offset` 从 0 开始，`line` / `column` 从 1 开始。`compileSfc` 会将内联 `<template>` 位置映射到完整 SFC 源码；外部 `<template src>` 则使用解析后的外部文件名和其自身位置。内置 `<json>` 和 `defineOptions` 改写后的 SFC 重解析错误也映射回输入源码，不依赖 `sourceMap` 开关。模板与 JSX 自有诊断会按 `diagnostic.message` 原样、仅一次地适配到 `warn` 回调；结构化消费应检查返回的 `diagnostics`，并捕获 `CompilerDiagnosticError`。

使用页面特性工具：

```ts
import {
  collectWevuPageFeatureFlags,
  injectWevuPageFeaturesInJs,
} from '@wevu/compiler'

const flags = collectWevuPageFeatureFlags(sourceCode)
const nextCode = injectWevuPageFeaturesInJs(sourceCode, flags)
```

## 配置

`compileSfc`（`compileVueFile`）常用选项：

- `isPage` / `isApp`
- `warn`：自定义警告输出
- `template`：模板编译参数
- `json`：配置合并策略
- `autoUsingComponents` / `autoImportTags`
- `wevuDefaults`：Wevu 默认配置

## 相关链接

- weapp-vite 文档：https://vite.weapp.dev/
- 仓库：https://github.com/weapp-vite/weapp-vite
