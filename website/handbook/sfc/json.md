---
title: JSON：页面配置放哪里
description: 从新项目默认实践出发，解释 defineAppJson、definePageJson、defineComponentJson 和 json 块各自的定位，以及什么时候还需要 usingComponents。
keywords:
  - handbook
  - sfc
  - json
  - definePageJson
  - defineAppJson
---

# JSON：页面配置放哪里

在小程序 SFC 里，除了模板和脚本，你还必须关心一类非常宿主化的内容：

- 页面标题
- 组件声明
- 页面或组件的 JSON 配置

新用户一开始最容易问的是：

> 我应该用 `<json>`，还是用宏？

## 新项目默认推荐：优先用 JSON 宏

优先使用：

- `defineAppJson`
- `definePageJson`
- `defineComponentJson`

一个页面的推荐写法：

```vue
<script setup lang="ts">
definePageJson(() => ({
  navigationBarTitleText: '订单详情',
  enablePullDownRefresh: true,
}))
</script>
```

这样做的好处是：

- 和 `script setup` 放在同一个认知空间里
- 更利于类型提示
- 更适合新项目统一风格

## App、Page、Component 分别怎么写

### App

```vue
<script setup lang="ts">
defineAppJson({
  pages: [
    'pages/home/index',
    'pages/profile/index',
  ],
})
</script>
```

### Page

```vue
<script setup lang="ts">
definePageJson(() => ({
  navigationBarTitleText: '商品详情',
}))
</script>
```

### Component

```vue
<script setup lang="ts">
defineComponentJson(() => ({
  component: true,
}))
</script>
```

## `<json>` 什么时候还会出现

`<json>` 块仍然可以兼容老代码，但对于新项目来说，它更像是历史兼容能力，而不是默认入口。

例如旧代码里可能是：

```vue
<json>
{
  "navigationBarTitleText": "示例页"
}
</json>
```

如果你正在重构或新建页面，通常优先迁移到宏写法会更统一。

## `usingComponents` 什么时候需要

如果你是直接导入 `.vue` 子组件，很多场景下不需要手写 `usingComponents`。

例如：

```vue
<script setup lang="ts">
import GoodsCard from '../../components/goods-card/index.vue'
</script>
```

但这些场景仍然可能需要：

- 引入非 `.vue` 的原生小程序组件
- 接第三方小程序组件库路径
- 某些明确要求 JSON 显式声明的组件映射

一个典型例子：

```vue
<script setup lang="ts">
definePageJson(() => ({
  usingComponents: {
    'custom-native-card': '/components/custom-native-card/index',
  },
}))
</script>
```

## 一个新用户很实用的判断方法

如果你问“这段内容属于脚本逻辑还是宿主配置”，就看它是否在描述：

- 页面标题
- 页面是否下拉刷新
- 组件路径映射
- 组件是不是 `component: true`

如果是，这类东西通常就应该进 JSON 宏。

## 一句话建议

新项目统一用 JSON 宏；只有兼容历史代码或接原生组件时，再考虑 `<json>` 或显式 `usingComponents`。

接下来建议继续看：

- [组件：拆分、导入与注册](/handbook/sfc/components)
- [事件与 v-model：怎么绑定最稳](/handbook/sfc/events-and-v-model)
