<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignSwitchPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-switch',
}))

const value = ref(true)
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-switch
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-switch :value="value" />
    </view>
  </view>
</template>
