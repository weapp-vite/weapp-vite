<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignRatePage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-rate',
}))

const value = ref(3)
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-rate
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-rate :value="value" />
    </view>
  </view>
</template>

