<script setup lang="ts">
import { getCurrentInstance, onReady, ref } from 'wevu'

const ready = ref(false)
const instance = getCurrentInstance() as any

function switchTab(event: WechatMiniprogram.TouchEvent) {
  const index = Number(event.currentTarget.dataset.index ?? 0)
  const pagePath = index === 1
    ? '/pages/issue-151/index'
    : '/pages/index/index'

  wx.switchTab({
    url: pagePath,
  })
}

function _runE2E() {
  return {
    ready: ready.value,
    hasOnReadyField: Object.prototype.hasOwnProperty.call(instance ?? {}, '__onReady__'),
    onReadyFieldType: typeof instance?.__onReady__,
    wevuHooksType: Array.isArray(instance?.__wevuHooks?.onReady)
      ? 'array'
      : typeof instance?.__wevuHooks?.onReady,
  }
}

onReady(() => {
  ready.value = true
})

defineExpose({
  _runE2E,
})
</script>

<template>
  <view class="issue151-tabbar">
    <button
      class="issue151-tabbar-item"
      data-index="0"
      @tap="switchTab"
    >
      home
    </button>
    <button
      class="issue151-tabbar-item"
      data-index="1"
      @tap="switchTab"
    >
      issue151
    </button>
  </view>
</template>

<style scoped>
.issue151-tabbar {
  display: flex;
  min-height: 96rpx;
  background: #fff;
  border-top: 1rpx solid #d1d5db;
}

.issue151-tabbar-item {
  flex: 1;
  min-width: 0;
  min-height: 96rpx;
  padding: 0;
  font-size: 24rpx;
  line-height: 96rpx;
  color: #111827;
  background: transparent;
  border: 0;
  border-radius: 0;
}
</style>
