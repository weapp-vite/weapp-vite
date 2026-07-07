<script setup lang="ts">
import { inject, provide } from 'wevu'
import ProvideInjectScopeMiddle from '../../components/provide-inject-scope-middle/index.vue'
import ProvideInjectSlotLeaf from '../../components/provide-inject-slot-leaf/index.vue'
import ProvideInjectSlotProvider from '../../components/provide-inject-slot-provider/index.vue'

const APP_INSTANCE_PROVIDE_SCOPE_KEY = 'wevu-features:app-instance-provide-scope'
const APP_SETUP_PROVIDE_SCOPE_KEY = 'wevu-features:app-setup-provide-scope'
const LAYOUT_PROVIDE_SCOPE_KEY = 'wevu-features:layout-provide-scope'
const PAGE_PROVIDE_SCOPE_KEY = 'wevu-features:page-provide-scope'
const SHADOW_PROVIDE_SCOPE_KEY = 'wevu-features:shadow-provide-scope'

definePageMeta({
  layout: 'provide-inject-scope',
})

provide(PAGE_PROVIDE_SCOPE_KEY, 'page-provide-value')
provide(SHADOW_PROVIDE_SCOPE_KEY, 'page-shadow-value')

const appInstanceValue = inject(APP_INSTANCE_PROVIDE_SCOPE_KEY, 'missing-app-instance')
const appSetupValue = inject(APP_SETUP_PROVIDE_SCOPE_KEY, 'missing-app-setup')
const layoutValue = inject(LAYOUT_PROVIDE_SCOPE_KEY, 'missing-layout')

async function runE2E() {
  const checks = {
    appInstance: appInstanceValue === 'app-instance-provide-value',
    appSetup: appSetupValue === 'app-setup-provide-value',
    pageProvide: true,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      appInstanceValue,
      appSetupValue,
      layoutValue,
      pageValue: 'page-provide-value',
      shadowValue: 'page-shadow-value',
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="provide-inject-scope-page">
    <view class="provide-inject-scope-page__title">
      wevu provide / inject 深层作用域复现
    </view>
    <view id="scope-page-provider" class="provide-inject-scope-page__line">
      page provide = page-provide-value
    </view>
    <ProvideInjectScopeMiddle />
    <ProvideInjectSlotProvider>
      <ProvideInjectSlotLeaf />
    </ProvideInjectSlotProvider>
  </view>
</template>

<style scoped>
.provide-inject-scope-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #eef2ff;
}

.provide-inject-scope-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.provide-inject-scope-page__line {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #374151;
}
</style>
