<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'Agent 验收',
})

const count = ref(0)
</script>

<template>
  <view class="page">
    <text id="count" data-testid="count">{{ count }}</text>
    <button id="increment" data-testid="increment" @tap="count += 1">
      增加一次
    </button>
  </view>
</template>

<style>
.page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 48rpx;
}
</style>
