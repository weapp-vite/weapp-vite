<script setup lang="ts">
import { provide } from 'wevu'
import ProvideInjectScopeLevel02 from '../provide-inject-scope-level-02/index.vue'

const COMPONENT_PROVIDE_SCOPE_KEY = 'wevu-features:component-provide-scope'
const SHADOW_PROVIDE_SCOPE_KEY = 'wevu-features:shadow-provide-scope'

provide(COMPONENT_PROVIDE_SCOPE_KEY, 'component-provide-value')
provide(SHADOW_PROVIDE_SCOPE_KEY, 'component-shadow-value')
</script>

<template>
  <view class="provide-inject-scope-level">
    <ProvideInjectScopeLevel02 />
  </view>
</template>

<style scoped>
.provide-inject-scope-level {
  margin-top: 8rpx;
}
</style>
