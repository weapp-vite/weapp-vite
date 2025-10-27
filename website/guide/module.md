# 模块化风格

`weapp-vite` 基于 ESM（ECMAScript Modules）进行构建。坚持使用 `import` / `export` 能获得更好的类型推导、Tree Shaking、热更新体验。本页整理了在小程序项目中常见的模块写法陷阱与解决方案。

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

原生小程序允许在脚本中写 `import x from 'a/b/c'` 或 `import x from '/x/y/z'`，但在标准 ESM 中这些写法并不合法。建议遵循以下约定：

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
> 如果第三方库同时提供 `module` 字段，weapp-vite 会优先使用其 ESM 版本。仍然遇到导入问题时，可以考虑通过 [`optimizeDeps.include`](/config/npm-and-deps.md#weapp-npm) 或转换插件提前处理。

## 其他最佳实践

- **保持文件后缀明确**：在导入本地文件时保留 `.ts`/`.js` 后缀可以减少构建器的解析工作，但不是必需；保持团队一致即可。
- **避免动态 `require`**：这会导致打包时无法静态分析依赖，推荐改用 `import()` 动态导入或显式列出需要的模块。
- **导出命名更清晰**：优先使用命名导出（`export const foo = ...`），默认导出保留给“文件只提供一个核心实体”的场景。
