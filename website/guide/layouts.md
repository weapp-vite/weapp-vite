---
title: 页面 Layout 使用指南
description: 详细说明 weapp-vite 的页面 layout 能力，包括 srcRoot/layouts 目录约定、definePageMeta、routeRules 与运行时 setPageLayout 切换。
keywords:
  - weapp-vite
  - layout
  - definePageMeta
  - routeRules
  - setPageLayout
  - usePageLayout
---

# 页面 Layout 使用指南

`weapp-vite` 现在已经支持接近 Nuxt `app/layouts` 的页面布局能力。它不是单独某一个配置项，而是由“目录约定 + 编译期声明 + 配置层回退 + 运行时切换”四部分协同完成。

## 1. 先理解这套能力解决什么问题

如果你的项目里有这些重复结构：

- 页面统一的头部、底部、侧边栏
- 后台页、营销页、沉浸式页三种不同壳子
- 同一个页面在运行时需要切换“带壳”和“无壳”两种模式

那就适合用 layout，而不是在每个页面里重复包一层公共组件。

| 能力                                  | 作用                       |
| ------------------------------------- | -------------------------- |
| `srcRoot/layouts/**`                  | 声明可用的布局组件         |
| `definePageMeta({ layout })`          | 在页面里显式指定布局       |
| `weapp.routeRules`                    | 为一批页面批量设置默认布局 |
| `setPageLayout()` / `usePageLayout()` | 在运行时切换或读取当前布局 |

## 2. layout 放在哪里

默认约定是放在 `srcRoot/layouts/` 下：

```txt
src/
├─ layouts/
│  ├─ default.vue
│  ├─ admin.vue
│  └─ native-shell/
│     ├─ index.json
│     ├─ index.wxml
│     ├─ index.wxss
│     └─ index.ts
└─ pages/
   └─ dashboard/
      └─ index.vue
```

支持两种 layout 形式：

| 形式        | 说明                     | 典型文件                          |
| ----------- | ------------------------ | --------------------------------- |
| Vue layout  | 用 Vue SFC 写页面壳      | `layouts/default.vue`             |
| 原生 layout | 用原生小程序组件写页面壳 | `layouts/native-shell/index.wxml` |

layout 名称由相对 `layouts/` 的路径推导：

| 文件位置                       | 推导出的 layout 名 |
| ------------------------------ | ------------------ |
| `layouts/default.vue`          | `default`          |
| `layouts/admin.vue`            | `admin`            |
| `layouts/native-shell/index.*` | `native-shell`     |

> **注意**：`default` 具有特殊意义。只要它存在，页面在没有显式声明 `layout` 时，就会优先尝试命中默认布局。

## 3. 页面里怎么声明 layout

### 3.1 默认命中 `default`

如果项目里存在 `src/layouts/default.vue`，而页面没有写 `definePageMeta({ layout })`，就会自动使用默认布局。

```vue
<script setup lang="ts">
definePageJson(() => ({
  navigationBarTitleText: '默认布局页面',
}))
</script>

<template>
  <view>page content</view>
</template>
```

### 3.2 显式指定命名 layout

```vue
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
})
</script>

<template>
  <view>admin content</view>
</template>
```

### 3.3 指定 layout + props

```vue
<script setup lang="ts">
definePageMeta({
  layout: {
    name: 'admin',
    props: {
      sidebar: true,
      title: '控制台',
    },
  },
})
</script>
```

### 3.4 显式关闭 layout

```vue
<script setup lang="ts">
definePageMeta({
  layout: false,
})
</script>
```

这类页面适合登录页、全屏页、沉浸式落地页。

## 4. `definePageMeta({ layout })` 的约束

这部分需要特别注意，因为它是编译期静态分析的：

| 支持的写法                                         | 是否支持 |
| -------------------------------------------------- | -------- |
| `layout: 'admin'`                                  | ✅       |
| `layout: false`                                    | ✅       |
| `layout: { name: 'admin', props: { title: 'A' } }` | ✅       |
| `layout: someRef.value`                            | ❌       |
| `layout: computed(() => 'admin')`                  | ❌       |
| `props: dynamicObject`                             | ❌       |

也就是说：

- `layout` 只支持静态字符串、`false`，或 `{ name, props }` 对象
- `props` 必须是对象字面量
- `props` 的键名必须是静态键名

> **提示**：如果你需要按状态切换 layout，不要把 `layout.name` 写成响应式值，而应该改用运行时 `setPageLayout()`。

## 5. `routeRules` 怎么和 layout 配合

如果你不想每个页面都手写 `definePageMeta({ layout })`，可以在 `vite.config.ts` 里用 `weapp.routeRules` 批量声明默认布局。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    routeRules: {
      'pages/dashboard/**': {
        appLayout: 'dashboard',
      },
      'pages/admin/**': {
        appLayout: {
          name: 'admin',
          props: {
            sidebar: true,
            title: 'Admin',
          },
        },
      },
    },
  },
})
```

### 5.1 优先级

优先级从高到低：

1. 页面源码里的 `definePageMeta({ layout })`
2. `weapp.routeRules`
3. `srcRoot/layouts/default.*`

如果页面显式写了：

```ts
definePageMeta({
  layout: false,
})
```

那就会跳过默认 layout 包裹。

## 6. 运行时怎么切换 layout

如果页面需要在运行过程中切换 layout，可以使用 `setPageLayout()`。

### 6.1 Wevu 页面写法

```vue
<script setup lang="ts">
import { ref, setPageLayout, usePageLayout } from 'wevu'

const currentLayout = ref<'default' | 'admin' | 'none'>('default')
const pageLayout = usePageLayout()

function applyDefaultLayout() {
  currentLayout.value = 'default'
  setPageLayout('default')
}

function applyAdminLayout() {
  currentLayout.value = 'admin'
  setPageLayout('admin', {
    title: '业务后台布局',
    subtitle: '这个标题来自 setPageLayout() 运行时传入的 props。',
  })
}

function clearLayout() {
  currentLayout.value = 'none'
  setPageLayout(false)
}

console.log(pageLayout.name)
</script>
```

### 6.2 原生 Page 写法

原生页面也可以切换 layout。当前 `setPageLayout` 也会从 `weapp-vite/runtime` 侧暴露给原生 Page 使用。

```ts
import { setPageLayout } from 'weapp-vite/runtime'

Page({
  onLoad() {
    setPageLayout('default')
  },
  applyAdminLayout() {
    setPageLayout('admin', {
      title: 'Native Console',
      subtitle: '这个标题来自原生 Page 调用 setPageLayout()。',
    })
  },
  clearLayout() {
    setPageLayout(false)
  },
})
```

### 6.3 `usePageLayout()` 有什么用

`usePageLayout()` 用于读取当前页面的 layout 状态：

```ts
import { usePageLayout } from 'wevu'

const pageLayout = usePageLayout()

if (pageLayout.name === 'admin') {
  console.log(pageLayout.props.title)
}
```

当项目里存在 layout 扫描结果时，`.weapp-vite/wevu-layouts.d.ts` 会自动增强 `WevuPageLayoutMap`，从而让 `layout.name` 与 `props` 拿到更严格的类型提示。

## 7. Vue layout 和原生 layout 怎么选

| 场景                       | 更推荐的方式                  |
| -------------------------- | ----------------------------- |
| 页面本身就是 Vue SFC 项目  | 优先 Vue layout               |
| 你需要纯原生小程序组件布局 | 原生 layout                   |
| 团队里有大量原生 Page      | 原生 layout 更容易渐进迁移    |
| 需要和现有组件体系保持统一 | 优先与页面技术栈一致的 layout |

### 7.1 Vue layout 示例

```vue
<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <view class="layout-admin">
    <view class="layout-admin__header">
      {{ title || "后台布局" }}
    </view>
    <slot />
  </view>
</template>
```

### 7.2 原生 layout 示例

```wxml
<view class="layout-admin">
  <view class="layout-admin__header">{{title || '后台布局'}}</view>
  <slot></slot>
</view>
```

```json
{
  "component": true
}
```

## 8. layout 相关类型文件

启用 layout 后，常见会看到这些支持文件：

| 文件                            | 作用                       |
| ------------------------------- | -------------------------- |
| `.weapp-vite/wevu-layouts.d.ts` | 增强 `WevuPageLayoutMap`   |
| `.weapp-vite/components.d.ts`   | 补齐自动组件与布局组件类型 |

如果你在编辑器里没有拿到 layout 类型提示，优先检查：

1. 是否执行过 `weapp-vite prepare`
2. `tsconfig.json` 是否已经引用 `.weapp-vite/*`
3. `srcRoot/layouts/**` 是否位于当前项目真实源码根目录下

## 9. 常见问题

**Q1: 为什么我写了 `layout: computed(() => 'admin')` 不生效？**

因为 `definePageMeta({ layout })` 是编译期静态分析，不会执行响应式表达式。需要动态切换时请改用 `setPageLayout()`。

**Q2: 为什么 `default` 布局会自动包裹页面？**

因为 `default` 是约定式默认 layout。页面没写 `definePageMeta({ layout })` 时，会把它作为最后一层回退。

**Q3: 为什么原生页面也能切 layout？**

因为当前 runtime 已经为页面实例补齐了 `setPageLayout()` 的调用链，原生 Page 也可以显式切换当前页面壳。

## 10. 总结

layout 能力的核心不是“多一个配置项”，而是让“页面内容”和“页面外壳”真正分层：

- `srcRoot/layouts/**` 负责定义壳
- `definePageMeta({ layout })` 负责页面声明
- `routeRules` 负责批量回退
- `setPageLayout()` 负责运行时切换

如果你现在要落地这套能力，建议先从 `default` + 一个命名 layout 开始，再按需要引入运行时切换。

## 11. 参考资源

| 主题                  | 推荐入口                                                          |
| --------------------- | ----------------------------------------------------------------- |
| Route Rules 与 Layout | [config/route-rules](/config/route-rules)                         |
| `layouts/` 目录说明   | [directory-structure/layouts](/guide/directory-structure/layouts) |
| Wevu 运行时 API       | [wevu/api/setup-context](/wevu/api/setup-context)                 |
| 目录结构总览          | [guide/directory-structure](/guide/directory-structure/)          |
