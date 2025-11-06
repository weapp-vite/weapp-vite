# 自动导入组件配置 {#auto-import-components}

## `weapp.autoImportComponents` {#weapp-autoimportcomponents}
- **类型**：
  ```ts
  {
    globs?: string[]
    resolvers?: Resolver[]
    output?: string | boolean
    typedComponents?: boolean | string
    htmlCustomData?: boolean | string
  }
  ```
- **默认值**：`undefined`
- **适用场景**：
  - 希望在 WXML 中直接使用组件标签，而无需手写 `usingComponents`。
  - 需要扫描本地组件目录，并与第三方 UI 库（TDesign、Vant 等）统一注册。
  - 想生成补全文件（`auto-import-components.json`、`typed-components.d.ts`、`mini-program.html-data.json`）提升 IDE 体验。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'
import { TDesignResolver, VantResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  weapp: {
    autoImportComponents: {
      globs: ['src/components/**/*'],
      resolvers: [
        VantResolver(),
        TDesignResolver(),
      ],
      output: 'dist/auto-import-components.json',
      typedComponents: true,
      htmlCustomData: 'dist/mini-program.html-data.json',
    },
  },
})
```

### 字段说明

- `globs`: 指定自动扫描的组件目录，需同时存在 `.wxml`、`.js/ts`、`.json` 且 `json.component === true`。
- `resolvers`: 插件化的第三方组件解析器，可扩展 UI 库映射关系。
- `output`: 控制是否生成 `auto-import-components.json` 清单；传入字符串可自定义输出位置。
- `typedComponents`: 是否生成类型声明，传入字符串可自定义文件路径。
- `htmlCustomData`: 生成 VS Code/微信开发者工具可读的 `mini-program.html-data.json`，用于标签与属性提示。

> [!TIP]
> 自动导入默认会忽略原生组件（如 `view`、`text`）。如需排除额外标签，可结合 [`weapp.wxml.excludeComponent`](/config/wxml.md#weapp-wxml) 定制过滤逻辑。

更多实践示例可参考 [自动引入组件](/guide/auto-import) 指南。
