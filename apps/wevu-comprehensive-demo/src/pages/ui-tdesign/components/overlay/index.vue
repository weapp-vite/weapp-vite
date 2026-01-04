<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignOverlayPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-overlay',
}))

const visible = ref(false)
function open() { visible.value = true }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-overlay
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-button size="small" @click="open">打开</t-button>
      <t-overlay :visible="visible" @click="visible = false" />
    </view>
  </view>
</template>

