---
title: Route Rules 与 Layout
description: 使用 weapp.routeRules 为页面批量声明默认 layout，并结合 srcRoot/layouts 与 definePageMeta 实现页面外壳复用。
keywords:
  - 配置
  - config
  - routeRules
  - layout
  - definePageMeta
  - setPageLayout
---

# Route Rules 与 Layout {#route-rules-layout}

`weapp-vite` 当前已经支持页面级 layout。它不是单独某一个开关，而是由以下几部分协同工作：

- `srcRoot/layouts/**`：声明可用的 layout 组件或原生 layout 目录
- `definePageMeta({ layout })`：在页面里显式指定 layout
- `weapp.routeRules`：在配置层为一批页面声明默认 layout
- `setPageLayout()` / `usePageLayout()`：在运行时切换或读取当前页面 layout 状态

[[toc]]

## `weapp.routeRules`

- **类型**：
  ```ts
  Record<
    string,
    {
      appLayout?:
        | string
        | false
        | {
            name: string;
            props?: Record<string, unknown>;
          };
    }
  >;
  ```
- **默认值**：`undefined`

示例：

```ts
import { defineConfig } from "weapp-vite/config";

export default defineConfig({
  weapp: {
    routeRules: {
      "pages/dashboard/**": {
        appLayout: "dashboard",
      },
      "pages/admin/**": {
        appLayout: {
          name: "admin",
          props: {
            sidebar: true,
            title: "Admin",
          },
        },
      },
    },
  },
});
```

作用：

- 为一批页面提供默认 layout
- 当页面本身没有写 `definePageMeta({ layout })` 时，作为回退规则生效
- 适合后台壳子、仪表盘壳子、营销页壳子这类“按目录批量套 layout”的场景

## 优先级

优先级从高到低：

1. 页面源码里的 `definePageMeta({ layout })`
2. `weapp.routeRules`
3. `srcRoot/layouts/default.*` 作为默认 layout

如果页面显式写了：

```ts
definePageMeta({
  layout: false,
});
```

则会跳过默认 layout 包裹。

## layout 文件放哪里

默认约定在 `srcRoot/layouts/` 下：

```text
src/
  layouts/
    default.vue
    admin.vue
    dashboard.vue
    native-shell/
      index.json
      index.wxml
      index.wxss
      index.ts
```

支持两种 layout 形式：

- `*.vue`：Vue layout 组件
- 原生四件套目录或文件：原生小程序 layout

layout 名称会根据相对 `layouts/` 目录的路径推导，例如：

- `layouts/default.vue` → `default`
- `layouts/admin.vue` → `admin`
- `layouts/native-shell/index.*` → `native-shell`

## 页面里怎么声明

### 1. 直接指定 layout 名

```vue
<script setup lang="ts">
definePageMeta({
  layout: "admin",
});
</script>
```

### 2. 指定 layout + props

```vue
<script setup lang="ts">
definePageMeta({
  layout: {
    name: "dashboard",
    props: {
      sidebar: true,
      title: "控制台",
    },
  },
});
</script>
```

### 3. 显式关闭 layout

```vue
<script setup lang="ts">
definePageMeta({
  layout: false,
});
</script>
```

> [!NOTE]
> `definePageMeta().layout` 只支持静态字符串、`false`，或 `{ name, props }` 对象。
> `props` 必须是对象字面量，键名必须是静态的。

## 运行时动态切换

如果页面需要在运行过程中切换 layout，可以使用 `wevu` 提供的 API：

```ts
import { setPageLayout, usePageLayout } from "wevu";

const currentLayout = usePageLayout();

function switchToAdmin() {
  setPageLayout("admin", {
    sidebar: true,
    title: "管理后台",
  });
}

function switchToPlain() {
  setPageLayout(false);
}
```

当项目里存在 layout 扫描结果时，`.weapp-vite/wevu-layouts.d.ts` 会自动为这些 API 生成更严格的类型提示。

## layout 相关类型文件

layout 能力会联动生成：

- `.weapp-vite/wevu-layouts.d.ts`
- `.weapp-vite/components.d.ts`

其中 `wevu-layouts.d.ts` 会增强 `WevuPageLayoutMap`，让 `setPageLayout()` 与 `usePageLayout()` 拿到 layout 名称和 props 类型。

## 适用场景

- 按页面目录批量挂载同一套页面壳子
- 让业务页面复用导航栏、侧边栏、底部容器等布局结构
- 在 Vue layout 与原生 layout 间混合使用
- 在页面运行时按状态切换 layout

## 相关文档

- [页面 Layout 使用指南](/guide/layouts)
- [layouts 目录说明](/guide/directory-structure/layouts)
- [Vue SFC 配置](/config/vue)
- [TypeScript 支持文件](/config/typescript)
- [Wevu 概览](/wevu/)
