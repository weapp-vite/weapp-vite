<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignSliderPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-slider',
}))

const value = ref(30)
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-slider
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-slider :value="value" />
    </view>
  </view>
</template>
