# JSON 配置 {#json-config}

`weapp-vite` 拓展了小程序 JSON/JSONC 的解析能力，允许在配置文件中使用注释、别名以及更友好的组件引用方式。本节聚焦顶层的 `weapp.jsonAlias`，帮助你在大型项目中维护简洁的 `usingComponents` 路径。

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
        { find: '@/components/', replacement: path.resolve(__dirname, 'src/components/') },
        { find: /^@icons\//, replacement: path.resolve(__dirname, 'src/assets/icons/') },
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

JSON 别名仅影响 `.json/.jsonc` 文件；脚本与模板中的别名仍由 tsconfig 与 Vite 负责。通常建议同时在 `tsconfig.json` 中配置：

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

## 常见问题

- **别名没有生效？** 请确认 `replacement` 是否为绝对路径，并检查是否与其他插件产生冲突。
- **可以给 WXML/WXS 写别名吗？** 目前仅支持 JSON，脚本与模板请继续使用 Vite/tsconfig 方案。
- **正则别名怎么写？** 可参考上方示例使用 `^@icons\/` 形式；需要捕获变量时也可以使用 RegExp 分组。

---

下一步：若你还需要调优 JS/TS 的路径解析，请前往 [JS 配置](/config/js.md) 了解 `weapp.tsconfigPaths` 的详细选项。
