---
title: "@weapp-vite/eslint"
description: "@weapp-vite/eslint 提供 Wevu 兼容性与小程序 AppService runtime API 静态检查规则。"
keywords:
  - Weapp-vite
  - Wevu
  - eslint
  - compatibility
  - "@weapp-vite/eslint"
---

# @weapp-vite/eslint

`@weapp-vite/eslint` 在源码阶段识别不能直接迁移到小程序运行时的 Vue 生态 API，以及不可移植的浏览器、Node 和现代内建 runtime API。

## 安装

```bash
pnpm add -D @weapp-vite/eslint eslint
```

## 配置

```js
import {
  miniProgramRuntimeRecommended,
  wevuCompatibilityRecommended,
} from '@weapp-vite/eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  miniProgramRuntimeRecommended,
  wevuCompatibilityRecommended,
])
```

推荐配置包含：

- `wevu/no-unsupported-api`：禁止静态可确定的不支持导入，并给出替代 API。
- `wevu/no-risky-api`：警告同名但参数、时序或宿主语义不同的 API。
- `wevu/no-unsupported-template-feature`：只对能追溯到 `vue-router` 导入的 `RouterLink` 模板能力报错，避免误伤本地同名组件。
- `mini-program/no-unsupported-runtime-api`：禁止 DOM/Node 全局和超出 ES2018 小程序兼容基线的现代内建。
- `mini-program/no-implicit-runtime-polyfill`：警告 `queueMicrotask`、`fetch`、`URL`、`AbortController` 等需要 weapp-vite 注入或显式兼容层的能力。

runtime preset 默认只匹配 `src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}`，并忽略 config、测试、脚本、Web-only、`node_modules`、构建产物和 `.weapp-vite`。局部绑定、类型位置和单纯 `typeof` 探测不会报错。

```js
import { createMiniProgramRuntimeConfig } from '@weapp-vite/eslint'

export default defineConfig([
  createMiniProgramRuntimeConfig({ files: ['app/**/*.ts'] }),
])
```

静态规则不能替代目标平台真实 IDE AppService 验证。尤其不能根据浏览器、Node、类型声明或单个 DevTools 版本，假定所有微信基础库都存在 `queueMicrotask`。

兼容矩阵也从根入口导出：

```ts
import {
  findWevuCompatibilityEntry,
  wevuCompatibilityCatalog,
} from '@weapp-vite/eslint'
```

旧项目可以继续从 `weapp-vite/eslint` 和 `weapp-vite/compatibility` 导入兼容转出入口。
