<script setup lang="ts">
import { inject } from 'wevu'

const APP_INSTANCE_PROVIDE_SCOPE_KEY = 'wevu-features:app-instance-provide-scope'
const APP_SETUP_PROVIDE_SCOPE_KEY = 'wevu-features:app-setup-provide-scope'
const LAYOUT_PROVIDE_SCOPE_KEY = 'wevu-features:layout-provide-scope'

const appInstanceValue = inject(APP_INSTANCE_PROVIDE_SCOPE_KEY, 'missing-app-instance')
const appSetupValue = inject(APP_SETUP_PROVIDE_SCOPE_KEY, 'missing-app-setup')
const layoutValue = inject(LAYOUT_PROVIDE_SCOPE_KEY, 'missing-layout')
</script>

<template>
  <view class="provide-inject-scope-layout-probe">
    <view id="scope-layout-app-instance-value" class="provide-inject-scope-layout-probe__line">
      layout app instance inject = {{ appInstanceValue }}
    </view>
    <view id="scope-layout-app-setup-value" class="provide-inject-scope-layout-probe__line">
      layout app setup inject = {{ appSetupValue }}
    </view>
    <view id="scope-layout-own-value" class="provide-inject-scope-layout-probe__line">
      layout own inject = {{ layoutValue }}
    </view>
  </view>
</template>

<style scoped>
.provide-inject-scope-layout-probe {
  padding: 14rpx;
  margin-top: 14rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 12rpx;
}

.provide-inject-scope-layout-probe__line {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #334155;
}
</style>
