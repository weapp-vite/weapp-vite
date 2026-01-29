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

- weapp-vite 文档：https://vite.icebreaker.top/
- 仓库：https://github.com/weapp-vite/weapp-vite
