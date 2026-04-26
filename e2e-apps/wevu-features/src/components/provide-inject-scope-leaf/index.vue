<script setup lang="ts">
import { computed, inject } from 'wevu'

const APP_INSTANCE_PROVIDE_SCOPE_KEY = 'wevu-features:app-instance-provide-scope'
const APP_SETUP_PROVIDE_SCOPE_KEY = 'wevu-features:app-setup-provide-scope'
const PAGE_PROVIDE_SCOPE_KEY = 'wevu-features:page-provide-scope'
const LAYOUT_PROVIDE_SCOPE_KEY = 'wevu-features:layout-provide-scope'
const COMPONENT_PROVIDE_SCOPE_KEY = 'wevu-features:component-provide-scope'
const SHADOW_PROVIDE_SCOPE_KEY = 'wevu-features:shadow-provide-scope'

const appInstanceValue = inject(APP_INSTANCE_PROVIDE_SCOPE_KEY, 'missing-app-instance')
const appSetupValue = inject(APP_SETUP_PROVIDE_SCOPE_KEY, 'missing-app-setup')
const pageValue = inject(PAGE_PROVIDE_SCOPE_KEY, 'missing-page')
const layoutValue = inject(LAYOUT_PROVIDE_SCOPE_KEY, 'missing-layout')
const componentValue = inject(COMPONENT_PROVIDE_SCOPE_KEY, 'missing-component')
const shadowValue = inject(SHADOW_PROVIDE_SCOPE_KEY, 'missing-shadow')

const summaryText = computed(() => [
  `appInstance=${appInstanceValue}`,
  `appSetup=${appSetupValue}`,
  `page=${pageValue}`,
  `layout=${layoutValue}`,
  `component=${componentValue}`,
  `shadow=${shadowValue}`,
].join('; '))
</script>

<template>
  <view class="provide-inject-scope-leaf">
    <view id="scope-app-instance-value" class="provide-inject-scope-leaf__line">
      app instance inject = {{ appInstanceValue }}
    </view>
    <view id="scope-app-setup-value" class="provide-inject-scope-leaf__line">
      app setup inject = {{ appSetupValue }}
    </view>
    <view id="scope-page-value" class="provide-inject-scope-leaf__line">
      page inject = {{ pageValue }}
    </view>
    <view id="scope-layout-value" class="provide-inject-scope-leaf__line">
      layout inject = {{ layoutValue }}
    </view>
    <view id="scope-component-value" class="provide-inject-scope-leaf__line">
      component inject = {{ componentValue }}
    </view>
    <view id="scope-shadow-value" class="provide-inject-scope-leaf__line">
      shadow inject = {{ shadowValue }}
    </view>
    <view id="scope-summary" class="provide-inject-scope-leaf__summary">
      {{ summaryText }}
    </view>
  </view>
</template>

<style scoped>
.provide-inject-scope-leaf {
  padding: 18rpx;
  margin-top: 16rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 12rpx;
}

.provide-inject-scope-leaf__line {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #334155;
}

.provide-inject-scope-leaf__summary {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}
</style>
