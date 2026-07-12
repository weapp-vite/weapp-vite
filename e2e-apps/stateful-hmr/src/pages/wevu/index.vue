<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  component: true,
  navigationBarTitleText: 'Wevu Stateful HMR',
})

const marker = 'STATEFUL-WEVU-BASE'
const count = ref(0)
const input = ref('')

function increment() {
  count.value += 1
}

defineExpose({ increment })
</script>

<template>
  <view class="page">
    <view class="marker">
      {{ marker }}
    </view>
    <view class="count">
      {{ count }}
    </view>
    <input v-model="input" class="input">
    <button class="increment" @tap="increment">
      increment
    </button>
  </view>
</template>

<style>
.page {
  padding: 24rpx;
}

.marker,
.count,
.input {
  margin-bottom: 16rpx;
}
</style>
