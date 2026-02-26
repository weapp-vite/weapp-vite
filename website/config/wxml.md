---
title: WXML 配置
description: weapp-vite 会扫描 WXML 以完成组件自动导入、WXS 依赖分析与模板产物输出。本页说明 weapp.wxml 的配置项与当前生效范围。
keywords:
  - 配置
  - config
  - wxml
  - weapp-vite
  - 会扫描
  - 以完成组件自动导入
  - wxs
---

# WXML 配置 {#wxml-config}

`weapp-vite` 会扫描 WXML 以完成组件自动导入、WXS 依赖分析与模板产物输出。本页说明 `weapp.wxml` 的配置项与当前生效范围。

[[toc]]

## `weapp.wxml` {#weapp-wxml}
- **类型**：
  ```ts
  boolean | {
    // 扫描阶段
    excludeComponent?: (tagName: string) => boolean
    platform?: MpPlatform

    // 模板处理阶段（当前版本未接入配置）
    removeComment?: boolean
    transformEvent?: boolean
    scriptModuleExtension?: string
    scriptModuleTag?: string
    templateExtension?: string
  }
  ```
- **默认值**：`true`

### 当前版本的实际生效范围

- **已生效**：`excludeComponent` / `platform`（影响 WXML 扫描）。
- **尚未接入**：`removeComment` / `transformEvent` / `scriptModuleExtension` / `scriptModuleTag` / `templateExtension`。

### 示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      excludeComponent(tag) {
        return tag.startsWith('demo-')
      },
    },
  },
})
```

> [!NOTE]
> 当前版本即便设置 `weapp.wxml = false`，仍会进行基础扫描与产物输出；该字段主要保留用于后续增强选项的统一入口。

---

相关能力：
- [自动导入组件配置](/config/auto-import-components.md#weapp-autoimportcomponents)
- [WXS 配置](/config/wxs.md)
