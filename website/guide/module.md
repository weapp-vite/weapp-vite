---
title: 模块化风格
description: Weapp-vite 基于 ESM（ECMAScript Modules）进行构建。建议在业务代码里尽量统一使用 import /
  export，这样类型推导、Tree Shaking、热更新都会更稳定。
keywords:
  - guide
  - module
  - 模块化风格
  - Weapp-vite
  - 基于
  - ESM（ECMAScript
  - import
  - /
---

# 模块化风格

`weapp-vite` 基于 ESM（ECMAScript Modules）进行构建。建议在业务代码里尽量统一使用 `import` / `export`，这样类型推导、Tree Shaking、热更新都会更稳定。

本页总结了小程序项目里常见的模块写法问题，以及对应的更稳妥写法。

## 统一改用 ESM

推荐在业务代码中全部采用 ESM，而不是混用 CommonJS (`require` / `module.exports`)。

```ts
// ✅ 推荐写法
import foo from '@/utils/foo'
import './register-global-components'

export default foo
export const bar = 'bar'

// ❌ 不推荐
const foo = require('@/utils/foo')
module.exports = foo
```

ESM 具备静态依赖图，打包器可以在构建期分析模块边界、自动移除未使用的导出，性能和可维护性都会更好。

## 处理路径差异

原生小程序里经常能见到 `import x from 'a/b/c'` 或 `import x from '/x/y/z'` 这种写法，但在标准 ESM 中它们并不总是合法（尤其是以 `/` 开头时会被当作 URL/根路径语义）。建议遵循以下约定：

- 使用 `./` 或 `../` 引入同目录、上级目录代码。
- 使用别名（如 `@/`）指向 `src` 根目录，避免 `/foo/bar` 这种会被当作 URL 解析的写法。

```ts
// 推荐
import util from './utils'
import config from '@/config'

// 可能导致路径解析错误
import util from 'utils'
import config from '/config'
```

别名配置请参考 [路径别名指南](/guide/alias)。

## 混合 ESM 与 CJS 时的注意事项

如果引用的第三方包仍然使用 CommonJS，请避免直接解构导入。标准的方式是使用命名空间导入，然后再手动解构：

```js
// apple.js (CommonJS)
module.exports = {
  a,
  b,
  c,
}

// ESM 中引用
import * as apple from './apple'
const { a, b, c } = apple
```

或者使用默认导入：

```js
import apple from './apple'
const { a, b, c } = apple
```

> [!TIP]
> 如果第三方库同时提供 `module` 字段，Weapp-vite 会优先使用其 ESM 版本。仍然遇到导入问题时，可以考虑通过 [`optimizeDeps.include`](/config/npm.md#weapp-npm) 或转换插件提前处理。

## 其他最佳实践

- **保持文件后缀明确**：在导入本地文件时保留 `.ts`/`.js` 后缀可以减少构建器的解析工作，但不是必需；保持团队一致即可。
- **避免动态 `require`**：这会导致打包时无法静态分析依赖，推荐改用 `import()` 动态导入或显式列出需要的模块。
- **导出命名更清晰**：优先使用命名导出（`export const foo = ...`），默认导出保留给“文件只提供一个核心实体”的场景。

## 微信小程序中的 WebAssembly

微信小程序项目可以使用 Vite 的 `?init` 入口加载源码或 npm 包中的 `.wasm` 文件：

```ts
import init from './encoder.wasm?init'

const instance = await init({})
instance.exports.compute(42)
```

微信构建会将文件作为非内联代码包资源发布，并让初始化器调用 `WXWebAssembly.instantiate`。主包和普通分包的资源放在主包可访问的位置；独立分包的资源留在对应包内；Worker 的资源不放入 Worker 脚本目录。Web 构建仍使用 Vite 自身的 WASM 行为。

该入口仅支持微信小程序源码/npm 文件，不支持 `publicDir`、小程序插件项目、lib mode、`?raw`、`?url`、`?inline` 组合或 stateful `bundledDev`。stateful 开发请切换 `weapp.hmr.runtime: 'classic'`。它只提供加载入口，不包含 wasm-bindgen、Emscripten 等 glue 代码，也不保证微信与浏览器支持相同的 WASM 指令、Global、SIMD 或编译选项。主线程与 Worker 的最低基础库要求不同，具体程序能力仍由微信运行环境决定。
