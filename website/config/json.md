# JSON 配置 {#json-config}

`weapp-vite` 支持原生 `json/jsonc`，并提供 **JSON 别名** 与 **JSON 合并策略**，方便在 `app.json / page.json / component.json` 中复用配置。

[[toc]]

## `weapp.jsonAlias` {#weapp-jsonalias}
- **类型**：`{ entries?: Record<string, string> | { find: string | RegExp; replacement: string }[] }`
- **默认值**：`undefined`
- **作用范围**：**仅作用于 `usingComponents`**（其他字段保持原样）。

```ts
import path from 'node:path'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    jsonAlias: {
      entries: [
        { find: '@/components/', replacement: path.resolve(import.meta.dirname, 'src/components/') },
        { find: /^@icons\//, replacement: path.resolve(import.meta.dirname, 'src/assets/icons/') },
      ],
    },
  },
})
```

JSON/JSONC 中可直接使用别名：

```jsonc
{
  "usingComponents": {
    "nav-bar": "@/components/navigation-bar",
    "logo-icon": "@icons/logo"
  }
}
```

构建产物会转换为相对路径：

```json
{
  "usingComponents": {
    "nav-bar": "../../components/navigation-bar",
    "logo-icon": "../../assets/icons/logo"
  }
}
```

> [!TIP]
> `replacement` 推荐使用**绝对路径**，避免因工作目录变化导致解析失败。

## `weapp.json.defaults` {#weapp-json-defaults}
- **类型**：`{ app?: Record<string, any>; page?: Record<string, any>; component?: Record<string, any> }`
- **默认值**：`undefined`
- **作用**：给 app/page/component JSON 注入统一默认值。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    json: {
      defaults: {
        app: {
          entryPagePath: 'pages/index/index',
        },
        page: {
          navigationStyle: 'custom',
        },
        component: {
          styleIsolation: 'apply-shared',
        },
      },
    },
  },
})
```

说明：
- 默认值会在生成 `.json` 产物时合并。
- 页面/组件自身的 JSON（或 SFC `<json>` / 宏）会覆盖默认值。

## `weapp.json.mergeStrategy` {#weapp-json-merge-strategy}
- **类型**：`'deep' | 'assign' | 'replace' | (target, source, ctx) => Record<string, any> | void`
- **默认值**：`'deep'`

```ts
export default defineConfig({
  weapp: {
    json: {
      mergeStrategy: 'assign',
    },
  },
})
```

函数策略会收到上下文：

```ts
export default defineConfig({
  weapp: {
    json: {
      mergeStrategy(target, source, ctx) {
        if (ctx.kind === 'page' && ctx.stage === 'defaults') {
          return { ...target, ...source }
        }
        return { ...source, ...target }
      },
    },
  },
})
```

常见 `ctx.stage`：`defaults` / `json-block` / `auto-using-components` / `component-generics` / `macro` / `emit` / `merge-existing`。

---

需要配置脚本别名？请前往 [JS 配置](/config/js.md#weapp-tsconfigpaths)。
