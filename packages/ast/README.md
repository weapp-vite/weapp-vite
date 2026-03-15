# @weapp-vite/ast

## 简介

`@weapp-vite/ast` 提供 weapp-vite 体系内可复用的 AST 解析与静态分析能力，统一封装 Babel 与 Oxc 两套后端，并抽出跨包共享的分析操作，供 `weapp-vite`、`wevu`、`@wevu/compiler` 等包复用。

## 特性

- 统一的 Babel / Oxc 解析入口
- JS / TS / JSX / TSX 源码解析
- 平台 API、`require`、`script setup import` 等轻量分析
- 组件 `props`、特性标记、JSX 自动组件等共享分析操作
- 面向业务包的可参数化分析器，避免重复实现

## 安装

```bash
pnpm add @weapp-vite/ast
```

## 使用

解析源码：

```ts
import { parseJsLikeWithEngine } from '@weapp-vite/ast'

const babelAst = parseJsLikeWithEngine('export const value = 1')
const oxcAst = parseJsLikeWithEngine('export const value = 1', {
  engine: 'oxc',
  filename: 'inline.ts',
})
```

收集通用特性标记：

```ts
import { collectFeatureFlagsFromCode } from '@weapp-vite/ast'

const flags = collectFeatureFlagsFromCode(code, {
  astEngine: 'oxc',
  moduleId: 'wevu',
  hookToFeature: {
    onLoad: 'enableShare',
    onShow: 'enableShow',
  },
})
```

收集 JSX 自动组件：

```ts
import { collectJsxAutoComponentsFromCode } from '@weapp-vite/ast'

const result = collectJsxAutoComponentsFromCode(code, {
  astEngine: 'babel',
  isCollectableTag(tag) {
    return !['view', 'text'].includes(tag)
  },
  isDefineComponentSource(source) {
    return source === 'vue' || source === 'wevu'
  },
})
```

## 导出能力

- `parseJsLikeWithEngine`
- `collectComponentPropsFromCode`
- `collectFeatureFlagsFromCode`
- `collectJsxAutoComponentsFromCode`
- `mayContainPlatformApiAccess`
- `collectRequireTokens`
- `collectScriptSetupImportsFromCode`

## 相关链接

- 文档：https://vite.icebreaker.top/
- 仓库：https://github.com/weapp-vite/weapp-vite
