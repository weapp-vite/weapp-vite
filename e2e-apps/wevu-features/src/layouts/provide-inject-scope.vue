<script setup lang="ts">
import { provide } from 'wevu'
import ProvideInjectScopeLayoutProbe from '../components/provide-inject-scope-layout-probe/index.vue'

const LAYOUT_PROVIDE_SCOPE_KEY = 'wevu-features:layout-provide-scope'

defineComponentJson({
  component: true,
})

provide(LAYOUT_PROVIDE_SCOPE_KEY, 'layout-provide-value')
</script>

<template>
  <view class="provide-inject-scope-layout">
    <view id="scope-layout-provider" class="provide-inject-scope-layout__line">
      layout provide = layout-provide-value
    </view>
    <ProvideInjectScopeLayoutProbe />
    <slot />
  </view>
</template>

<style scoped>
.provide-inject-scope-layout {
  min-height: 100vh;
  padding: 18rpx;
  background: #eef2ff;
}

.provide-inject-scope-layout__line {
  font-size: 24rpx;
  color: #1e293b;
}
</style>
