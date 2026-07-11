## TypeScript 共用示例 {#router-examples}

下面一个示例同时覆盖创建、读取、守卫、动态路由和导航失败。

```vue
<script setup lang="ts">
import { onUnmounted } from 'wevu'
import { isNavigationFailure, useRoute, useRouter } from 'wevu/router'

const router = useRouter()
const route = useRoute()

const removeGuard = router.beforeEach((to) => {
  // 小程序没有浏览器 history；守卫返回位置对象时由宿主 API 重定向。
  if (to?.meta?.requiresLogin) {
    return { name: 'login' }
  }
})

const removeRoute = router.addRoute({ name: 'order', path: '/pages/order/index' })

async function openOrder(id: number) {
  const failure = await router.push({ name: 'order', params: { id } })
  if (isNavigationFailure(failure)) {
    console.warn(failure.type)
  }
}

// 组件卸载时移除动态注册内容，避免跨页面残留。
onUnmounted(() => {
  removeGuard()
  removeRoute()
})
</script>

<template>
  <view>{{ route.fullPath }}</view>
  <button @tap="openOrder(42)">
    打开订单
  </button>
</template>
```
