<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignPopoverPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-popover',
}))

const visible = ref(false)
function open() { visible.value = true }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-popover
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-button size="small" @click="open">打开</t-button>
      <t-popover :visible="visible" content="t-popover" @close="visible = false">
        <view style="padding: 12rpx 16rpx; background: #111827; color: #fff; border-radius: 12rpx">anchor</view>
      </t-popover>
    </view>
  </view>
</template>

