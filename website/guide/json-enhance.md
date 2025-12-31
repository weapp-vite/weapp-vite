# 使用 TS/JS 生成 JSON

小程序项目中存在大量结构类似的 `json` 配置。`weapp-vite` 在兼容原生 `json/jsonc` 的基础上，允许你使用 `json.ts`、`json.js` 生成最终的配置文件，让配置也能享受模块化、类型提示与复用能力。

一个组件若名为 `custom`，框架会按以下优先级查找配置文件：`custom.jsonc` → `custom.json` → `custom.json.ts` → `custom.json.js`。因此你可以在需要时逐步升级为脚本驱动的配置。

## 为什么要用脚本生成 JSON？

- **复用与拆分**：直接 `import` 共享配置，避免复制粘贴。
- **类型安全**：借助 TypeScript 或 JSDoc 获得智能提示、错误提示。
- **动态拼装**：在同一文件中根据条件判断、合并配置，更易维护。

## 快速示例

以下示例展示了同一组件的三种写法。`defineComponentJson` 只是为了提供类型提示，不会修改你传入的内容。

> 如果你使用的是 Vue SFC（`.vue`）并希望把配置写在 `<script setup>` 里（而不是单独写 `*.json.ts`），可以使用 `definePageJson / defineComponentJson` 等 build-time 宏，详见：[Vue SFC · Script Setup JSON 宏](/guide/vue-sfc/config#script-setup-json-macros)。

::: code-group

```json [navigation-bar.json]
{
  "component": true,
  "styleIsolation": "apply-shared",
  "usingComponents": {}
}
```

```ts [navigation-bar.json.ts]
import { defineComponentJson } from 'weapp-vite/json'

export default defineComponentJson({
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
})
```

```js [navigation-bar.json.js]
import { defineComponentJson } from 'weapp-vite/json'

export default defineComponentJson({
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
})
```

:::

同理，你可以使用 `defineAppJson`、`definePageJson`、`defineSitemapJson`、`defineThemeJson` 等帮助函数（详见 `@/snippets/export-json.ts`）。

> [!WARNING]
> 这些 `defineXXX` 函数只提供类型辅助，不会自动补齐字段。例如组件配置仍需显式写出 `"component": true`。

## 获得类型提示

`weapp-vite/json` 导出了多种类型定义，支持直接在 TypeScript 或 JSDoc 中使用。

::: code-group

```ts [navigation-bar.json.ts]
import type { Component } from 'weapp-vite/json'

export default <Component>{
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
}
```

```js [navigation-bar.json.js]
/**
 * @type {import('weapp-vite/json').Component}
 */
export default {
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
}
```

:::

更多导出类型可在 `@/snippets/export-json-type.ts` 中查看。

## 组合与复用配置

使用脚本后，可以像写普通模块一样组合配置、引入别名路径：

```ts
import type { Page } from 'weapp-vite/json'
import sharedTheme from '@/assets/shared.config'
import sharedLocal from './shared.json.ts'

export default <Page>{
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-divider': 'tdesign-miniprogram/divider/divider',
    'ice-avatar': '@/avatar/avatar',
  },
  ...sharedTheme,
  ...sharedLocal,
}
```

- `@/assets/shared.config` 通过别名引入，weapp-vite 会根据 `tsconfig.json` 的 `baseUrl` 和 `paths` 自动解析。
- 多个配置对象会被合并后再输出到最终的 `page.json`。

## 提示与最佳实践

- 优先使用 `jsonc`：需要简单注释时，`jsonc` 就足够；当出现跨模块复用、条件拼装时再升级到 `json.ts`。
- 保持纯函数：尽量让 `json.ts` 导出的对象保持幂等，避免引入与构建环境相关的副作用。
- 配合 `lint-staged`：如果团队使用格式化工具，记得把 `.json.ts`、`.json.js` 也纳入格式化与校验流程。
