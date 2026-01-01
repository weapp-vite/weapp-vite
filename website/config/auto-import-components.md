# 自动导入组件配置 {#auto-import-components}

这项能力用来解决一个很常见的问题：你在 WXML 里写了组件标签，但不想再去 `page.json` / `component.json` 里手动维护 `usingComponents`。开启后 weapp-vite 会在构建时扫描组件目录，并自动补全配置（也支持接入 Vant、TDesign 等第三方组件库）。

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
- **默认值**：默认开启。
  - 主包自动扫描 `components/**/*.wxml`
  - 分包自动扫描 `subPackages.<root>/components/**/*.wxml`
  - 如需关闭：设置 `autoImportComponents: false`（或 `{ globs: [] }`）；也可以在 `subPackages.<root>.autoImportComponents` 里只对某个分包停用。
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
      globs: ['components/**/*.wxml'],
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

- `globs`: 指定要扫描的组件目录。通常要求同目录下有 `.wxml`、`.js/ts`、`.json`，并且 `.json` 里写了 `component: true`。
- `resolvers`: 第三方组件库解析器（例如 Vant、TDesign），用来把 `<van-button>` 这类标签映射到对应 npm 组件路径。
- `output`: 控制是否生成 `auto-import-components.json` 清单；传入字符串可自定义输出位置。
- `typedComponents`: 是否生成类型声明，传入字符串可自定义文件路径。
- `htmlCustomData`: 生成 VS Code/微信开发者工具可读的 `mini-program.html-data.json`，用于标签与属性提示。

> [!TIP]
> 自动导入默认会忽略原生组件（如 `view`、`text`）。如果你还想忽略更多标签（例如项目里的占位标签），可以用 [`weapp.wxml.excludeComponent`](/config/wxml.md#weapp-wxml) 做过滤。

更多实践示例可参考 [自动引入组件](/guide/auto-import) 指南。
