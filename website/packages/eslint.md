---
title: "@weapp-vite/eslint"
description: "@weapp-vite/eslint 为 Wevu 项目提供 Vue、Pinia 与 Vue Router 兼容性静态检查规则。"
keywords:
  - Weapp-vite
  - Wevu
  - eslint
  - compatibility
  - "@weapp-vite/eslint"
---

# @weapp-vite/eslint

`@weapp-vite/eslint` 是 Wevu 项目的兼容性静态检查包，用于在源码阶段识别不能直接迁移到小程序运行时的 Vue、Pinia 和 Vue Router API。

## 安装

```bash
pnpm add -D @weapp-vite/eslint eslint
```

## 配置

```js
import { wevuCompatibilityRecommended } from '@weapp-vite/eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  wevuCompatibilityRecommended,
])
```

推荐配置包含：

- `wevu/no-unsupported-api`：禁止静态可确定的不支持导入，并给出替代 API。
- `wevu/no-risky-api`：警告同名但参数、时序或宿主语义不同的 API。
- `wevu/no-unsupported-template-feature`：只对能追溯到 `vue-router` 导入的 `RouterLink` 模板能力报错，避免误伤本地同名组件。

规则默认忽略 `node_modules`、构建产物和 `.weapp-vite` 生成文件。动态属性访问、第三方依赖内部代码和宿主运行时能力不能由静态规则完整判定。

兼容矩阵也从根入口导出：

```ts
import {
  findWevuCompatibilityEntry,
  wevuCompatibilityCatalog,
} from '@weapp-vite/eslint'
```

旧项目可以继续从 `weapp-vite/eslint` 和 `weapp-vite/compatibility` 导入兼容转出入口。
