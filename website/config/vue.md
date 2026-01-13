# Vue SFC 配置 {#vue-config}

`weapp-vite` 内置对 Vue SFC 的支持（`.vue` → WXML/WXSS/JS/JSON），这页专门说明与 SFC 编译相关的配置项。

[[toc]]

## `weapp.vue.enable` {#weapp-vue-enable}
- **类型**：`boolean`
- **默认值**：`true`
- **说明**：保留字段。当前版本会在检测到 `.vue` 文件时自动启用 SFC 支持，该字段暂不影响行为。

## `weapp.vue.template` {#weapp-vue-template}
- **类型**：
  ```ts
  {
    removeComments?: boolean
    simplifyWhitespace?: boolean
    scopedSlotsCompiler?: 'auto' | 'augmented' | 'off'
    slotMultipleInstance?: boolean
    classStyleRuntime?: 'auto' | 'wxs' | 'js'
    classStyleWxsShared?: boolean
  }
  ```
- **适用场景**：希望调整模板编译产物（注释、空白、作用域插槽策略）。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        removeComments: true,
        simplifyWhitespace: true,
        scopedSlotsCompiler: 'auto',
        slotMultipleInstance: true,
        classStyleRuntime: 'auto',
        classStyleWxsShared: true,
      },
    },
  },
})
```

字段说明：

- `removeComments`: 是否移除模板注释。
- `simplifyWhitespace`: 是否简化空白字符。
- `scopedSlotsCompiler`: 作用域插槽编译策略：
  - `auto`: 自动选择最小可用方案（默认）。
  - `augmented`: 强制使用增强方案。
  - `off`: 关闭 scoped slot 编译，仅保留原生 slot（不支持 slot props）。
- `slotMultipleInstance`: `v-for` 下 scoped slot 多实例模式（默认开启）。
- `classStyleRuntime`: class/style 绑定运行时：
  - `auto`: 平台支持 WXS 时优先启用 WXS，否则回退到 JS（默认）。
  - `wxs`: 强制 WXS（不可用时回退并告警）。
  - `js`: 强制 JS 运行时。
- `classStyleWxsShared`: 是否复用 class/style 的 WXS helper（默认开启）。开启时主包与非独立分包共享一份 WXS，独立分包各自生成。

## `weapp.vue.autoImport` {#weapp-vue-autoimport}
- **类型**：`boolean`
- **默认值**：`undefined`
- **说明**：保留字段，当前不影响构建行为。

> [!TIP]
> 组件自动导入请使用 [`weapp.autoImportComponents`](/config/auto-import-components.md)，该功能面向 WXML/JSON 产物，而非脚本侧导入。
