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
  - layout-host
  - provide
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

如果你不想每个页面都手写 `definePageMeta({ layout })`，可以在 `vite.config.ts` 或 `weapp-vite.config.ts` 里用 `weapp.routeRules` 批量声明默认布局。

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

## 7. page 和 layout 怎么通信

layout 不只是“包一层壳”，还经常要解决页面和壳子之间的数据流与能力协作。建议先把几种通信方式的边界分清楚：

| 方式                                                          | 方向                     | 适合场景                   | 推荐程度 |
| ------------------------------------------------------------- | ------------------------ | -------------------------- | -------- |
| `definePageMeta({ layout: { name, props } })`                 | page -> layout           | 静态标题、模式、文案       | 高       |
| `setPageLayout(name, props)`                                  | page -> layout           | 运行时切换 layout 与 props | 高       |
| `usePageLayout()`                                             | page 读取 layout 状态    | 页面感知当前壳子模式       | 高       |
| store + page `watch`                                          | store -> page -> layout  | 统一管理布局状态与交互意图 | 高       |
| `layout-host` / `resolveLayoutHost()` / `waitForLayoutHost()` | page/组件 -> layout 宿主 | toast、dialog、反馈节点    | 高       |
| `provide()` / `inject()`                                      | 当前实例或全局兜底       | 局部上下文共享             | 低       |

### 7.1 通过 layout props 通信

最直接的方式是由页面把布局需要的静态信息传给 layout，例如标题、副标题、页面模式、头部按钮文案。

编译期静态场景：

```vue
<script setup lang="ts">
definePageMeta({
  layout: {
    name: 'admin',
    props: {
      title: '订单中心',
      subtitle: '这里的 props 会直接传给 admin layout。',
    },
  },
})
</script>
```

运行时动态场景：

```vue
<script setup lang="ts">
import { setPageLayout } from 'wevu'

function switchToReviewMode() {
  setPageLayout('admin', {
    title: '审核中心',
    subtitle: '标题和副标题由页面在运行时切换。',
  })
}
</script>
```

> **提示**：如果你的目标只是“页面告诉 layout 现在该显示什么”，优先用 `props`，不要一开始就引入额外的全局通信层。

### 7.2 页面读取当前 layout 状态

页面也可以通过 `usePageLayout()` 读取当前命中的 layout 名称与 props。这在“页面自身也要根据 layout 模式调整局部 UI”时很有用。

```vue
<script setup lang="ts">
import { computed, usePageLayout } from 'wevu'

const layout = usePageLayout()
const isAdminLayout = computed(() => layout.name === 'admin')
</script>

<template>
  <view>
    <text>当前布局：{{ layout.name || 'none' }}</text>
    <text v-if="isAdminLayout">{{ layout.props.title }}</text>
  </view>
</template>
```

适合这类场景：

- 页面想知道自己当前是否处于 `admin` / `default` / `false`
- 页面上的某个区块需要跟着 layout 模式切换
- 调试运行时布局切换结果

### 7.3 通过 store 让页面协调 layout

当 layout 状态来自 store 时，推荐的边界是：

- store 只保存“布局状态”和“交互意图”
- 页面负责 `watch` store，并调用 `setPageLayout()`
- layout 继续只关心自己的 props 和宿主能力

示例可以参考 e2e 用例里的 `e2e-apps/template-wevu-tdesign-regression/src/pages/layout-store/index.vue`。

```vue
<script setup lang="ts">
import { setPageLayout, storeToRefs, watch } from 'wevu'
import { useLayoutInteractionDemoStore } from '@/stores/layoutInteractionDemo'

const store = useLayoutInteractionDemoStore()
const { activeLayout, adminLayoutProps } = storeToRefs(store)

watch([activeLayout, adminLayoutProps], ([layout, props]) => {
  if (layout === 'admin') {
    setPageLayout('admin', props)
    return
  }
  setPageLayout('default')
}, { immediate: true })
</script>
```

这样做的好处是：

- store 不需要直接依赖 page runtime hook
- layout 切换逻辑仍然留在页面上下文，职责更清晰
- 后续替换 layout、增加平台差异处理时更容易收敛

### 7.4 通过 `layout-host` 暴露 layout 内宿主能力

有些能力天然属于 layout，而不是页面内容本身，例如 toast、dialog、抽屉、全局反馈层。这时更推荐把它们放在 layout 中，再通过 `layout-host` 暴露给页面或子组件使用。

layout 侧：

```vue
<template>
  <view class="layout-admin">
    <slot />
    <t-toast layout-host="layout-toast" />
    <t-dialog layout-host="layout-dialog" />
  </view>
</template>
```

页面或组件侧：

```ts
import { resolveLayoutHost, waitForLayoutHost } from 'wevu'

const toast = resolveLayoutHost<any>('layout-toast')
toast?.show?.({ message: '操作成功' })

const dialog = await waitForLayoutHost<any>('layout-dialog')
dialog?.show?.({ title: '确认删除？' })
```

这类模式的重点不是“拿到 layout 实例”，而是“拿到 layout 暴露出来的宿主能力”。因此建议：

- 页面/组件只调用业务 hook 或 `resolveLayoutHost()` / `waitForLayoutHost()`
- 不直接手写 `selectComponent()` 去找 layout 内部节点
- layout 内部组件的选择器和实现细节由 layout 自己维护

> **提示**：如果你的项目已经封装了 `useToast()`、`useDialog()` 一类 hook，优先让这些 hook 内部对接 `layout-host`，而不是把 layout 结构细节散落到页面代码里。

TDesign Toast/Dialog 可以按下面的形态封装为模板级 recipe。核心约束是：页面只调用业务 hook，hook 内部再解析 layout 暴露的宿主实例。

```ts
import { getCurrentInstance, resolveLayoutHost } from 'wevu'

interface ToastHost {
  show: (options: { message: string, theme?: string }) => void
}

export function showToast(message: string, theme = 'default') {
  const context = getCurrentInstance()
  const toast = resolveLayoutHost<ToastHost>('layout-toast', { context })
  toast?.show({
    message,
    ...(theme === 'default' ? {} : { theme }),
  })
}
```

这种封装不属于 `wevu` core 的 UI 能力：`wevu` 只负责 `layout-host` 的注册与解析，具体的 Toast/Dialog 参数、按钮行为和关闭逻辑仍然由 TDesign 或业务 hook 维护。

### 7.5 不推荐直接把 layout 当成父组件做祖先注入

很多人会先想到 Vue Web 里的 `provide()` / `inject()`。但在当前 `wevu` 运行时语义下，这不是 page/layout 主通信手段。

原因是当前版本没有完整的祖先组件树查找语义，`inject()` 不会像 Web Vue 那样稳定地沿着“layout -> page -> 子组件”逐级向上查找。更准确地说：

- `provide()` / `inject()` 优先作用于当前实例上下文
- 找不到时会回落到全局存储
- 它适合局部共享或全局兜底，不适合承担 page/layout 主通信链路

所以：

- ✅ page -> layout 传参，优先 `definePageMeta(...props)` 或 `setPageLayout(...props)`
- ✅ layout 内能力暴露，优先 `layout-host`
- ✅ 跨页面稳定共享状态，优先 store
- ❌ 不要默认假设 layout 可以像 Vue 父组件一样稳定向 page `inject()`

## 8. Vue layout 和原生 layout 怎么选

| 场景                       | 更推荐的方式                  |
| -------------------------- | ----------------------------- |
| 页面本身就是 Vue SFC 项目  | 优先 Vue layout               |
| 你需要纯原生小程序组件布局 | 原生 layout                   |
| 团队里有大量原生 Page      | 原生 layout 更容易渐进迁移    |
| 需要和现有组件体系保持统一 | 优先与页面技术栈一致的 layout |

### 8.1 Vue layout 示例

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

### 8.2 原生 layout 示例

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

## 9. layout 相关类型文件

启用 layout 后，常见会看到这些支持文件：

| 文件                            | 作用                       |
| ------------------------------- | -------------------------- |
| `.weapp-vite/wevu-layouts.d.ts` | 增强 `WevuPageLayoutMap`   |
| `.weapp-vite/components.d.ts`   | 补齐自动组件与布局组件类型 |

如果你在编辑器里没有拿到 layout 类型提示，优先检查：

1. 是否执行过 `wv prepare`
2. `tsconfig.json` 是否已经引用 `.weapp-vite/*`
3. `srcRoot/layouts/**` 是否位于当前项目真实源码根目录下

## 10. 常见问题

**Q1: 为什么我写了 `layout: computed(() => 'admin')` 不生效？**

因为 `definePageMeta({ layout })` 是编译期静态分析，不会执行响应式表达式。需要动态切换时请改用 `setPageLayout()`。

**Q2: 为什么 `default` 布局会自动包裹页面？**

因为 `default` 是约定式默认 layout。页面没写 `definePageMeta({ layout })` 时，会把它作为最后一层回退。

**Q3: 为什么原生页面也能切 layout？**

因为当前 runtime 已经为页面实例补齐了 `setPageLayout()` 的调用链，原生 Page 也可以显式切换当前页面壳。

**Q4: page 和 layout 之间推荐怎么通信？**

优先级建议是：`layout props` 解决 page -> layout 传参，`usePageLayout()` 解决页面读状态，`layout-host` 解决 layout 内宿主能力，store 负责跨页面或较复杂的交互状态。

**Q5: `provide()` / `inject()` 能不能拿来做 layout 到 page 的主通信？**

不建议。当前 `wevu` 没有完整的祖先组件树注入语义，`inject()` 更适合当前实例上下文共享或全局兜底，不应替代 layout props、store 或 `layout-host`。

## 11. 总结

layout 能力的核心不是“多一个配置项”，而是让“页面内容”和“页面外壳”真正分层：

- `srcRoot/layouts/**` 负责定义壳
- `definePageMeta({ layout })` 负责页面声明
- `routeRules` 负责批量回退
- `setPageLayout()` 负责运行时切换
- `layout-host` 负责暴露 layout 内部宿主能力

如果你现在要落地这套能力，建议先从 `default` + 一个命名 layout 开始，再按需要引入运行时切换。

最后可以按下面的顺序选型：

| 目标                     | 更推荐的方式                                  |
| ------------------------ | --------------------------------------------- |
| 页面给 layout 传静态信息 | `definePageMeta({ layout: { name, props } })` |
| 页面在运行时切换 layout  | `setPageLayout()`                             |
| 页面读取当前 layout      | `usePageLayout()`                             |
| 统一管理布局状态         | store + page `watch`                          |
| 访问 layout 内反馈节点   | `layout-host` / `resolveLayoutHost()`         |
| 共享全局状态             | store                                         |

## 12. 参考资源

| 主题                  | 推荐入口                                                          |
| --------------------- | ----------------------------------------------------------------- |
| Route Rules 与 Layout | [config/route-rules](/config/route-rules)                         |
| `layouts/` 目录说明   | [directory-structure/layouts](/guide/directory-structure/layouts) |
| Wevu 运行时 API       | [wevu/api/setup-context](/wevu/api/setup-context)                 |
| Wevu 运行时机制       | [wevu/runtime](/wevu/runtime)                                     |
| 目录结构总览          | [guide/directory-structure](/guide/directory-structure/)          |
