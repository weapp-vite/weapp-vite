---
title: Script Setup：推荐范式
---

# Script Setup：推荐范式

## 本章你会学到什么

- 用 `<script setup>` 组织页面/组件逻辑的推荐写法
- hooks、响应式、事件处理的基本套路

## 基本原则

- 响应式与 hooks：从 `wevu` 导入
- 页面/组件配置：优先用 JSON 宏或 `<json>` 块（见下一章）

## 页面示例（带生命周期）

```vue
<script setup lang="ts">
import { onPageScroll, onShow, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '示例页',
}))

const scrollTop = ref(0)

onShow(() => console.log('show'))
onPageScroll((e) => {
  scrollTop.value = e.scrollTop
})
</script>
```

## 常见坑

- hooks 不要写在异步回调里：必须在 `setup()` 同步阶段注册（详见 `/wevu/runtime`）
- `ref/reactive` 误从 `vue` 导入：会导致状态更新与 setData diff 脱节
