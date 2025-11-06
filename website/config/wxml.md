# WXML 配置 {#wxml-config}

`weapp-vite` 在不改变小程序原生语法的前提下，为 WXML 提供了若干增强能力，覆盖事件语法糖、注释处理以及额外模板收集等场景。本节聚焦顶层的 `weapp.wxml` 配置，帮助你按需开启或定制这些扩展。

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
  - 希望在模板中保留注释或统一移除构建后的注释内容。
  - 需要使用 `@tap` 等类 Vue 事件语法糖，由构建器自动转换为原生写法。
  - 想跳过特定标签的组件分析，例如保留某些符合命名规则的占位标签。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      removeComment: true,
      transformEvent: true,
      excludeComponent(tag) {
        return tag.startsWith('demo-')
      },
    },
  },
})
```

关闭该功能时可以直接传入 `false`，weapp-vite 会回退到原生编译逻辑：

```ts
export default defineConfig({
  weapp: {
    wxml: false,
  },
})
```

### 字段说明

- `removeComment`: 构建阶段剔除模板注释，减小产物体积，适合生产环境默认启用。
- `transformEvent`: 启用事件自动转换（如 `@tap="hello"` → `bind:tap="hello"`），日常开发可保持开启，亦可按需关闭以使用原生写法。
- `excludeComponent(tagName)`: 自定义过滤规则，返回 `true` 即忽略该标签的组件扫描，可与自动导入组件功能配合使用。

### 调优建议

1. **控制生效范围**：可结合 `include`/`exclude`（通过 Vite 插件配置）限制语法糖作用于特定目录，避免影响第三方模版。
2. **与 IDE 协同**：若团队使用的格式化插件暂不识别 `@tap` 写法，可在本地开发期间禁用 `transformEvent`，在构建或 CI 中再统一开启。
3. **关注调试输出**：配合 [`weapp.debug`](/config/shared.md#weapp-debug) 能快速排查模板是否被正确扫描与转换。

## 配置额外模板 {#additional-wxml}

静态分析无法感知运行时动态拼接的模板路径。当需要在运行时通过 `import` / `load` 等方式引入额外 WXML 时，可使用 [`weapp.isAdditionalWxml`](/config/paths.md#weapp-isadditionalwxml) 将它们纳入构建图谱：

```ts
export default defineConfig({
  weapp: {
    isAdditionalWxml(wxmlPath) {
      return wxmlPath.startsWith('src/templates/') && wxmlPath.endsWith('.wxml')
    },
  },
})
```

搭配 `autoImportComponents`、`watchFiles` 等能力，可以在调试阶段快速验证模板是否被收集，详见 [共享配置](/config/shared.md#weapp-autoimportcomponents)。

## 关联阅读

- [WXML 增强指南](/guide/wxml)：深入了解事件语法糖、静态分析机制与调试技巧。
- [自动引入组件](/guide/auto-import)：结合组件扫描时的标签过滤策略使用。
