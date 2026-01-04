<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignStepperPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-stepper',
}))

const value = ref(2)
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-stepper
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-stepper :value="value" />
    </view>
  </view>
</template>
