---
title: 自动导入组件配置
description: Weapp-vite 会在构建阶段扫描 WXML 组件标签并自动补齐 usingComponents，免去手写 JSON
  的负担。支持本地组件与第三方库 Resolver（如 Vant/TDesign）。
keywords:
  - 配置
  - 分包
  - config
  - auto
  - import
  - components
  - 自动导入组件配置
  - Weapp-vite
---

# 自动导入组件配置 {#auto-import-components}

`weapp-vite` 会在构建阶段扫描 WXML 组件标签并自动补齐 `usingComponents`，免去手写 JSON 的负担。支持本地组件与第三方库 Resolver（如 Vant/TDesign）。

[[toc]]

## `weapp.autoImportComponents` {#weapp-autoimportcomponents}
- **类型**：
  ```ts
  {
    globs?: string[]
    resolvers?: Resolver[]
    output?: string | boolean
    typedComponents?: boolean | string
    htmlCustomData?: boolean | string
    vueComponents?: boolean | string
    vueComponentsModule?: string
  } | false
  ```
- **默认值**：启用（自动生成默认 `globs`）。

默认扫描规则：
- 主包：`components/**/*.wxml`
- 分包：`<root>/components/**/*.wxml`（若该分包未显式禁用）

### 示例

```ts
import { defineConfig } from 'weapp-vite/config'
import { TDesignResolver, VantResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  weapp: {
    autoImportComponents: {
      globs: ['components/**/*.wxml'],
      resolvers: [VantResolver(), TDesignResolver()],
      output: true,
      typedComponents: true,
      htmlCustomData: 'dist/mini-program.html-data.json',
      vueComponents: true,
      vueComponentsModule: 'wevu',
    },
  },
})
```

### 字段说明

- `globs`：组件模板扫描范围（glob）。通常要求同目录下存在 `.wxml + .js/ts + .json`，且 JSON 内 `component: true`。
- `resolvers`：第三方组件库解析器，把标签映射到 npm 包路径（如 `<van-button>` → `@vant/weapp/button`）。
- `output`：生成 `auto-import-components.json` 清单。
  - `true` / 未设置：输出到 `vite.config.ts` 同级目录；
  - 字符串：自定义路径；
  - `false`：不生成清单。
- `typedComponents`：生成 `typed-components.d.ts`（WXML props 类型）。
- `htmlCustomData`：生成 `mini-program.html-data.json`（VS Code/DevTools 提示）。
- `vueComponents`：生成 `components.d.ts`（Vue SFC 模板补全）。
- `vueComponentsModule`：`components.d.ts` 的 `declare module 'xxx'` 模块名。使用 Wevu 时建议填 `wevu`。

### 禁用与分包覆盖

- 全局禁用：`autoImportComponents: false`
- 单独禁用分包：`weapp.subPackages.<root>.autoImportComponents = false`

> [!TIP]
> 如需排除额外标签（例如占位标签），可以在 `weapp.wxml.excludeComponent` 中过滤。

更多实践示例请参考 [自动引入组件](/guide/auto-import)。
