<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignPopupPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-popup',
}))

const visible = ref(false)
function open() { visible.value = true }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-popup
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-button size="small" @click="open">打开</t-button>
      <t-popup :visible="visible" placement="bottom" @close="visible = false">
        <view style="padding: 32rpx; background: #fff">popup content</view>
      </t-popup>
    </view>
  </view>
</template>

