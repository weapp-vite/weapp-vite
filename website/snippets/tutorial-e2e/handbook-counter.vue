<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: '首页',
})

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>

<template>
  <view class="page">
    <text class="title">
      Hello Weapp-vite
    </text>
    <text id="count-value">
      count: {{ count }}
    </text>
    <text id="doubled-value">
      doubled: {{ doubled }}
    </text>
    <button id="increment-button" @tap="count++">
      +1
    </button>
  </view>
</template>

<style scoped>
.page {
  padding: 32rpx;
}

.title {
  display: block;
  margin-bottom: 24rpx;
  font-size: 36rpx;
  font-weight: 600;
}
</style>
