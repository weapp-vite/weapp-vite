<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignDrawerPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-drawer',
}))

const visible = ref(false)
function open() { visible.value = true }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-drawer
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-button size="small" @click="open">打开</t-button>
      <t-drawer :visible="visible" placement="right" @close="visible = false">
        <view style="padding: 32rpx">drawer content</view>
      </t-drawer>
    </view>
  </view>
</template>

