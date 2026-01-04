<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignStepItemPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-step-item',
}))

const current = ref(1)
function onChange(event) { current.value = event.detail }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-step-item
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-steps :current="current" @change="onChange">
        <t-step-item title="Step 1" />
        <t-step-item title="Step 2" />
        <t-step-item title="Step 3" />
      </t-steps>
    </view>
  </view>
</template>
