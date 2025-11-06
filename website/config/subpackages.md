# 分包配置 {#subpackages-config}

在大型小程序项目中，合理拆分分包能够显著提升首屏速度与包体控制。`weapp-vite` 通过 `weapp.subPackages` 提供灵活的分包编译选项，涵盖独立分包、依赖裁剪、样式共享等常见需求。本节聚焦分包相关配置，帮助你精细化管理每个 `app.json` 分包。

[[toc]]

## `weapp.subPackages` {#weapp-subpackages}
- **类型**：
  ```ts
  type StylesEntry = {
    source: string
    scope?: 'all' | 'pages' | 'components'
    include?: string | string[]
    exclude?: string | string[]
  }

  Record<string, {
    independent?: boolean
    dependencies?: (string | RegExp)[]
    inlineConfig?: Partial<InlineConfig>
    autoImportComponents?: AutoImportComponents
    styles?: string | StylesEntry | Array<string | StylesEntry>
  }>
  ```
- **键名**：分包在 `app.json` 中的 `root`。
- **适用场景**：
  - 强制将某个分包转换为独立上下文，即使 `app.json` 未标记 `independent: true`。
  - 精确控制分包需要的 `miniprogram_npm` 依赖，避免主包依赖泄漏。
  - 为某个分包注入额外的构建配置或自动导入策略。
  - 复用共享样式文件，并按需限定注入范围。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'
import { VantResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  weapp: {
    subPackages: {
      packageA: {
        autoImportComponents: {
          globs: ['src/packageA/components/**/*.wxml'],
        },
        styles: [
          'styles/common.wxss',
          {
            source: 'styles/pages.css',
            scope: 'pages',
          },
          {
            source: 'styles/components.css',
            scope: 'components',
            include: ['components/**/index.*', 'components/**/theme/**/*'],
            exclude: ['components/legacy/**'],
          },
          {
            source: 'styles/forms.scss',
            include: ['forms/**/*.wxss', 'forms/**/style.(scss|sass|css)'],
            exclude: ['forms/drafts/**'],
          },
        ],
      },
      packageB: {
        independent: true,
        dependencies: ['buffer', /gm-crypto/],
        inlineConfig: {
          define: {
            'import.meta.env.PACKAGE_B': JSON.stringify(true),
          },
        },
        autoImportComponents: {
          resolvers: [VantResolver()],
        },
      },
    },
  },
})
```

### 字段说明 {#subpackages-fields}

- `independent`: 将分包编译为独立上下文，通常与微信后台“独立分包”设定一致。
- `dependencies`: 控制该分包打包到 `miniprogram_npm` 的依赖列表，可传字符串或正则，未匹配的依赖会被剔除。
- `inlineConfig`: 为该分包追加 Vite/Rolldown 配置（例如 `define`、`plugins`、`resolve` 等），不会影响其他分包。
- `autoImportComponents`: 为分包单独配置组件自动导入，避免与主包策略冲突。
- `styles`: 数组或对象，用于生成共享样式文件并自动注入到分包页面/组件：
  - `scope`: 快捷控制注入范围，支持 `all`（默认）、`pages`、`components`。
  - `include` / `exclude`: 追加 glob 规则，默认基于分包 `root`。
  - `source`: 支持 `.wxss`、`.css`、`.scss/.sass`、`.less`、`.styl(us)` 等常见格式，构建后会转换为目标平台样式后缀。
  - 当样式文件位于分包根目录并命名为 `index.*`、`pages.*`、`components.*` 时，会自动推断注入范围。

### 样式共享实战 {#subpackages-styles}

`styles` 选项的目标是消除重复的 `@import`，由构建器在不同分包中自动插入共享样式。无论分包是否为独立上下文，都可以：

1. 在主包（或公共目录）维护统一的基础样式。
2. 在 `subPackages.<name>.styles` 中声明入口或文件清单。
3. 由构建器在分包编译阶段生成对应产物，并向页面/组件样式补充 `@import`。

如果只需要特定页面或组件引用共享样式，可结合 `include` / `exclude` 精细控制。

### 常见问题

- **如何保证分包首屏体积最小？** 首先确认 `dependencies` 是否精确，确保无用依赖被排除；其次结合 [`chunks.sharedStrategy`](/config/build-and-output.md#chunksconfig) 控制跨包共享代码策略。
- **独立分包能使用主包的 autoImport 配置吗？** 可以，在 `subPackages.<name>.autoImportComponents` 中复用主包 resolver 或 globs，构建器会自动隔离产物。
- **分包样式冲突怎么办？** 如果样式需要差异化，可在 `styles` 中为不同分包提供独立入口，或者关闭 `scope`、使用 `include` 针对特定文件注入。

---

下一步：若项目同时使用 Worker，请继续阅读 [Worker 配置](./worker.md)。也可以浏览 [共享配置](/config/shared.md) 了解分包如何与自动导入、调试钩子协同工作。
