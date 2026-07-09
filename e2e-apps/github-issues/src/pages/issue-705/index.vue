<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'issue-705',
})

const route = useRoute()
const router = useRouter()
const routePath = computed(() => route.path)
const hookCalls: Array<{ phase: string, to?: string, from: string }> = []

router.beforeEach((to, from) => {
  hookCalls.push({
    phase: 'before',
    to: to?.path,
    from: from.path,
  })
})

router.afterEach((to, from) => {
  hookCalls.push({
    phase: 'after',
    to: to?.path,
    from: from.path,
  })
})

async function _runE2E(action?: 'push') {
  if (action === 'push') {
    await router.push('/pages/issue-550/index')
  }

  return {
    route: {
      path: route.path,
      fullPath: route.fullPath,
      name: route.name,
    },
    hooks: hookCalls.slice(),
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    class="issue705-page"
    :data-route-path="routePath"
  >
    <text class="issue705-title">
      issue-705 router route sync
    </text>
  </view>
</template>

<style scoped>
.issue705-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue705-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}
</style>
