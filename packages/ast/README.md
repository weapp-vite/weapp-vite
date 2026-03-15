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

## 稳定 API

建议优先从根入口导入稳定 API：

- `parseJsLikeWithEngine`
- `collectComponentPropsFromCode`
- `collectFeatureFlagsFromCode`
- `collectJsxAutoComponentsFromCode`
- `collectJsxImportedComponentsAndDefaultExportFromBabelAst`
- `collectJsxTemplateTagsFromBabelExpression`
- `mayContainPlatformApiAccess`
- `collectRequireTokens`
- `collectScriptSetupImportsFromCode`
- `unwrapTypeScriptExpression`
- `getObjectPropertyByKey`
- `getRenderPropertyFromComponentOptions`
- `resolveRenderExpressionFromComponentOptions`

## 子路径导出

如果需要更细粒度地按能力引用，也可以使用这些子路径导出：

- `@weapp-vite/ast/babel`
- `@weapp-vite/ast/babelNodes`
- `@weapp-vite/ast/engine`
- `@weapp-vite/ast/types`
- `@weapp-vite/ast/operations/componentProps`
- `@weapp-vite/ast/operations/featureFlags`
- `@weapp-vite/ast/operations/jsxAutoComponents`
- `@weapp-vite/ast/operations/platformApi`
- `@weapp-vite/ast/operations/require`
- `@weapp-vite/ast/operations/scriptSetupImports`

默认建议：

- 业务侧优先使用根入口
- 只有在需要低层 helper 或做更细粒度 tree-shaking 时，再使用子路径导入

## 发布校验

包内可直接运行以下命令做独立校验：

```bash
pnpm build
pnpm test
pnpm run check:release
```

## 相关链接

- 文档：https://vite.icebreaker.top/
- 仓库：https://github.com/weapp-vite/weapp-vite
