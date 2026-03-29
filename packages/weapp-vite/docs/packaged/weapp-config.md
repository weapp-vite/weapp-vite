# Weapp Config

## 入口位置

`weapp-vite` 的小程序配置通常放在：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
  },
})
```

## 高频配置项

### `srcRoot`

源码根目录。排查输出缺页、找不到入口、自动路由异常时先确认它。

### `autoRoutes`

适合希望用约定生成页面路由的项目。启用后要保持 pages 目录与输出约定稳定。

### `autoImportComponents`

适合用目录扫描自动注册组件的项目。组件重名时要先解决命名冲突，不要让自动引入规则长期处于歧义状态。

### `routeRules`

用于给页面路由追加规则，例如 layout、运行时行为等。它属于项目级编排，而不是组件内部语义。

### `layout`

页面 layout 既可能来自项目级规则，也可能来自页面侧 `definePageMeta`。排查时先确认是哪一层生效。

### `chunks.sharedStrategy`

常见策略：

- `duplicate`：偏向分包首开性能
- `hoist`：偏向共享抽取与包体控制

不要在 `srcRoot`、路由来源、分包边界都没确认前就先调 chunk 策略。

## CLI 与 IDE 命令

`weapp-vite` 原生命令优先，IDE 相关命令通过 `weapp-ide-cli` 透传。

例如：

```bash
weapp-vite build
weapp-vite preview --project ./dist/build/mp-weixin
weapp-vite ide preview --project ./dist/build/mp-weixin
```

## 继续阅读

- 项目结构与 `AGENTS.md`：[`project-structure.md`](./project-structure.md)
- wevu 运行时写法：[`wevu-authoring.md`](./wevu-authoring.md)
- Vue SFC 宏与模板：[`vue-sfc.md`](./vue-sfc.md)
