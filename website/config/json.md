# JSON 配置 {#json-config}

小程序项目里有大量 `app.json` / `page.json` / `component.json`。`weapp-vite` 在兼容原生的基础上，额外做了两件更“工程化”的事：

- 支持 `jsonc`：允许写注释，读起来更清楚
- 支持 JSON 别名：让 `usingComponents` 等路径不用写一堆 `../../`

这页聚焦 `weapp.jsonAlias`：专门用来给 JSON/JSONC 做别名映射。

[[toc]]

## `weapp.jsonAlias` {#weapp-jsonalias}
- **类型**：`{ entries?: Record<string, string> | { find: string | RegExp; replacement: string }[] }`
- **默认值**：`undefined`
- **适用场景**：在大量页面/组件 JSON 中引用同一套公共组件、图标目录或插件路径，希望使用别名提高可读性。

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

配置完成后，可在 JSON/JSONC 中直接使用别名：

```jsonc
{
  "usingComponents": {
    "nav-bar": "@/components/navigation-bar",
    "logo-icon": "@icons/logo"
  }
}
```

构建产物会自动转换为相对路径，确保小程序正确识别：

```json
{
  "usingComponents": {
    "nav-bar": "../../components/navigation-bar",
    "logo-icon": "../../assets/icons/logo"
  }
}
```

> [!TIP]
> 别名匹配规则与 Vite 一致，支持字符串与正则。`replacement` 建议始终填写绝对路径，以避免因工作目录变化导致解析失败。

## 与 JS/TS 别名协同 {#json-alias-cooperate}

JSON 别名只影响 `.json/.jsonc` 文件；脚本里的别名仍然由 tsconfig 与 Vite 负责。通常建议同时在 `tsconfig.json` 里也配一套（让脚本侧也能用 `@/`）：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

JS/TS 的解析行为可以通过 [`weapp.tsconfigPaths`](/config/js.md#weapp-tsconfigpaths) 微调，两者互不干扰。更多实践示例可参考 [路径别名指南](/guide/alias)。

## `weapp.json.defaults` {#weapp-json-defaults}
- **类型**：`{ app?: Record<string, any>; page?: Record<string, any>; component?: Record<string, any> }`
- **默认值**：`undefined`
- **适用场景**：希望给全局的 app/page/component JSON 提供统一默认值（例如统一注入 `navigationStyle`、`styleIsolation` 等字段）。

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

- 默认值会在生成 `.json` 产物时合并进去。
- 单个页面/组件的 `<json>` 或 `definePageJson()` 等宏声明会覆盖默认值。

## `weapp.json.mergeStrategy` {#weapp-json-merge-strategy}
- **类型**：`'deep' | 'assign' | 'replace' | (target, source, ctx) => Record<string, any> | void`
- **默认值**：`'deep'`
- **适用场景**：希望精确控制 JSON 合并顺序与冲突处理方式。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    json: {
      mergeStrategy: 'assign',
    },
  },
})
```

函数策略可拿到额外上下文（用于区分 app/page/component 与合并阶段）：

```ts
import { defineConfig } from 'weapp-vite/config'

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

`ctx.stage` 常见值包括：`defaults`、`json-block`、`auto-using-components`、`component-generics`、`macro`、`emit` 等。

## 常见问题

- **别名没有生效？** 请确认 `replacement` 是否为绝对路径，并检查是否与其他插件产生冲突。
- **可以给 WXML/WXS 写别名吗？** 这里讲的是 JSON 别名。脚本与模板请继续使用 tsconfig / Vite 的别名方案。
- **正则别名怎么写？** 可参考上方示例使用 `^@icons\/` 形式；需要捕获变量时也可以使用 RegExp 分组。

---

下一步：若你还需要调优 JS/TS 的路径解析，请前往 [JS 配置](/config/js.md) 了解 `weapp.tsconfigPaths` 的详细选项。
