# Vue SFC 配置 {#vue-config}

`weapp-vite` 内置 Vue SFC（`.vue` → WXML/WXSS/JS/JSON）编译链路。这里聚焦编译期可配置项。

[[toc]]

## `weapp.vue.enable` {#weapp-vue-enable}
- **类型**：`boolean`
- **默认值**：`true`
- **说明**：保留字段。当前版本会在检测到 `.vue` 时自动启用 SFC 支持，该字段不影响行为。

## `weapp.vue.template` {#weapp-vue-template}
- **类型**：
  ```ts
  {
    // 注意：removeComments / simplifyWhitespace 暂未接入编译流程
    removeComments?: boolean
    simplifyWhitespace?: boolean
    scopedSlotsCompiler?: 'auto' | 'augmented' | 'off'
    scopedSlotsRequireProps?: boolean
    slotMultipleInstance?: boolean
    classStyleRuntime?: 'auto' | 'wxs' | 'js'
    classStyleWxsShared?: boolean
  }
  ```

示例：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        scopedSlotsCompiler: 'auto',
        scopedSlotsRequireProps: true,
        slotMultipleInstance: true,
        classStyleRuntime: 'auto',
        classStyleWxsShared: true,
      },
    },
  },
})
```

字段说明：
- `scopedSlotsCompiler`：作用域插槽编译策略。
  - `auto`：自动选择最小可用方案（默认）。
  - `augmented`：强制使用增强方案。
  - `off`：关闭 scoped slot（仅保留原生 slot，不支持 slot props）。
- `scopedSlotsRequireProps`：仅在 slot 传递作用域参数时才生成 scoped slot 组件。默认值随 `scopedSlotsCompiler` 自动推导。
- `slotMultipleInstance`：`v-for` 下 scoped slot 多实例模式（默认 `true`）。
- `classStyleRuntime`：class/style 绑定运行时。
  - `auto`：平台支持 WXS 时优先 WXS，否则回退 JS（默认）。
  - `wxs`：强制 WXS，不支持时回退 JS 并告警。
  - `js`：强制 JS。
- `classStyleWxsShared`：是否复用 class/style 的 WXS helper（主包与非独立分包共享，独立分包各自生成）。

> [!NOTE]
> `removeComments` / `simplifyWhitespace` 目前尚未接入实际编译流程，仅保留类型入口。

## `weapp.vue.autoImport` {#weapp-vue-autoimport}
- **类型**：`boolean`
- **默认值**：`undefined`
- **说明**：保留字段，当前不影响构建行为。

> 组件自动导入请使用 [`weapp.autoImportComponents`](/config/auto-import-components.md)。
