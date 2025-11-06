# 增强能力与调试工具 {#enhance-and-debug}

`weapp-vite` 在模板、脚本和调试体验上做了诸多增强：

- WXML/WXS 自动补全与语法改写
- 自动导入组件生态
- 产物监控、`resolveId` 追踪等调试钩子

本节详细介绍顶层的 `weapp.wxml`、`weapp.wxs`、`weapp.autoImportComponents` 与 `weapp.debug` 配置，并结合常见问题提供调试建议。

[[toc]]

## `weapp.wxml` {#weapp-wxml}
- **类型**：
  ```ts
  boolean | {
    removeComment?: boolean
    transformEvent?: boolean
    excludeComponent?: (tagName: string) => boolean
  }
  ```
- **默认值**：`true`
- **适用场景**：
  - 希望在 WXML 中使用注释、事件语法增强。
  - 需要按需过滤自动扫描到的组件标签。

### 组合示例

```ts
import { defineConfig } from 'weapp-vite/config'
import { TDesignResolver, VantResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  weapp: {
    wxml: {
      removeComment: true,
      transformEvent: true,
    },
    wxs: true,
    autoImportComponents: {
      globs: ['src/components/**/*.wxml'],
      resolvers: [
        VantResolver({ importStyle: false }),
        TDesignResolver(),
      ],
    },
  },
})
```

#### 字段说明

- `wxml.removeComment`: 构建阶段剔除注释，减小产物体积。
- `wxml.transformEvent`: 启用事件自动转换（如自动补全 `bind:` / `catch:` 前缀）。
- `wxml.excludeComponent`: 对扫描到的标签名称进行过滤，返回 `true` 表示忽略该标签。
- `weapp.isAdditionalWxml`: 用于补充动态模板文件，详见 [`weapp.isAdditionalWxml`](/config/paths-and-generators.md#weapp-isadditionalwxml)。

## `weapp.wxs` {#weapp-wxs}
- **类型**：`boolean`
- **默认值**：`true`
- **适用场景**：启用 WXS 语法增强，包括模块化导入、现代语法降级等。如果项目需要保持原生语法，可显式设置为 `false`。

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
  - 自动注册本地组件或第三方 UI 组件（如 TDesign、Vant）。
  - 输出组件清单、类型声明以及 HTML Custom Data，提升 IDE 体验。

#### 字段说明

- `autoImportComponents.globs`: 指定自动扫描的组件目录，组件需同时存在 `.wxml` / `.js` / `.json` 且 `json.component === true`。
- `autoImportComponents.resolvers`: 插件化的第三方组件解析器，内置支持 TDesign、Vant，可自行扩展。
- `autoImportComponents.output`: 生成自动导入清单 `auto-import-components.json` 的路径配置。默认（`true` 或未配置）会把文件输出到配置文件同级目录，写入字符串可自定义相对/绝对路径，传入 `false` 则关闭生成。
- `autoImportComponents.typedComponents`: 控制是否生成 `typed-components.d.ts` 类型声明，`true` 使用默认路径，填写字符串可自定义输出位置。
- `autoImportComponents.htmlCustomData`: 输出 VS Code/WeChat DevTools 可识别的 `mini-program.html-data.json`，用于标签与属性提示，支持布尔值或自定义路径。

### 调优建议

1. **忽略内置组件冲突**：自动导入默认会忽略小程序原生组件（如 `view`），避免与项目自定义组件同名。
2. **按需引入样式**：部分 resolver（如 Vant）支持自定义 `importStyle`，可根据是否使用 Tailwind/自定义样式做调整。
3. **更多示例**：若想了解实践细节，请参见 [自动引入组件指南](/guide/auto-import) 与 [WXML/WXS 增强](/guide/wxml)。

## `weapp.enhance`（兼容层） {#weapp-enhance}

> [!WARNING]
> `weapp.enhance` 已废弃，将在 `weapp-vite@6` 中移除。请改用顶层的 `weapp.wxml`、`weapp.wxs` 与 `weapp.autoImportComponents`。保留该字段仅用于兼容旧版配置，读取时会自动迁移到对应的顶层字段并打印一次警告。

## `weapp.debug` {#weapp-debug}
- **类型**：
  ```ts
  {
    watchFiles?: (files: string[], meta?: SubPackageMetaValue) => void
    resolveId?: (id: string, meta?: SubPackageMetaValue) => void
    load?: (id: string, meta?: SubPackageMetaValue) => void
    inspect?: WrapPluginOptions
  }
  ```
- **适用场景**：排查文件变动、模块解析、加载顺序或产物生成问题。

### 监控示例

```ts
export default defineConfig({
  weapp: {
    debug: {
      watchFiles(files, meta) {
        const scope = meta?.subPackage.root ?? 'main'
        console.info(`[watch:${scope}]`, files)
      },
      resolveId(id) {
        if (id.includes('lodash')) {
          console.log('[resolveId]', id)
        }
      },
      load(id) {
        if (id.endsWith('.wxml')) {
          console.log('[load wxml]', id)
        }
      },
      inspect: {
        build: true,
      },
    },
  },
})
```

- `watchFiles`: 构建结束时返回监听到的文件，可区分主包与分包。
- `resolveId`: 追踪模块解析路径，适合定位别名或分包间引用问题。
- `load`: 监听模块加载，常用来确认 Transform 是否生效。
- `inspect`: 启用 [`vite-plugin-inspect`](https://github.com/antfu/vite-plugin-inspect)，可在浏览器中分析插件序列与产物。

### 常见调试技巧

1. **查看分包产物**：结合 `watchFiles` 与终端输出，确认独立分包的 `miniprogram_npm` 是否生成。
2. **定位构建卡顿**：在 `resolveId` / `load` 中输出时间戳，快速确认耗时模块。
3. **调试自动导入**：若组件未被识别，可查看 `load` 钩子中是否出现对应 `.json` 文件，或者在 `autoImportComponents.globs` 中增加更准确的匹配。

---

至此，你已经掌握 `weapp-vite` 的主要配置能力。若需要回到总览或查找其他主题，可返回 [配置概览](./index.md)。
