<script setup lang="ts">
import { nextTick, ref, useCssModule } from 'wevu'

const color = ref('#dc2626')
const defaultModule = useCssModule()
const namedModule = useCssModule('theme')

async function runE2E() {
  const before = color.value
  color.value = '#2563eb'
  await nextTick()

  const checks = {
    cssVarChanged: color.value !== before,
    defaultModule: typeof defaultModule.probe === 'string' && defaultModule.probe.length > 0,
    namedModule: typeof namedModule.accent === 'string' && namedModule.accent.length > 0,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    state: {
      color: color.value,
      defaultClass: defaultModule.probe,
      namedClass: namedModule.accent,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="style-page">
    <view class="style-page__title">
      SFC style ready
    </view>
    <view
      id="sfc-style-probe"
      :class="[$style.probe, namedModule.accent]"
      style="border: 4rpx solid #111827"
    >
      CSS vars + modules
      <view class="deep-probe">
        deep
      </view>
    </view>
    <view class="global-probe">
      global
    </view>
    <slot>
      <view class="slot-probe">
        slotted fallback
      </view>
    </slot>
  </view>
</template>

<style scoped module>
.style-page {
  padding: 24rpx;
}

.style-page__title {
  margin-bottom: 16rpx;
  font-weight: 700;
}

.probe {
  box-sizing: border-box;
  width: 240rpx;
  height: 96rpx;
  padding: 12rpx;
  color: #fff;
  background-color: v-bind(color);
}

:deep(.deep-probe) {
  font-size: 20rpx;
}

:global(.global-probe) {
  margin-top: 12rpx;
}

:slotted(.slot-probe) {
  color: #166534;
}
</style>

<style module="theme">
.accent {
  border-radius: 8rpx;
}
</style>
