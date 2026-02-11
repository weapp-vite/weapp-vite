<script setup lang="ts">
import { computed, ref } from 'wevu'

const source = ref(true)
const computedValue = computed(() => Boolean(source.value))
</script>

<template>
  <view class="computed-class-box">
    <view :class="computedValue ? 'a' : 'b'">
      computed class: {{ computedValue ? 'a' : 'b' }}
    </view>
  </view>
</template>

<style scoped>
.computed-class-box {
  margin-top: 20rpx;
}

.a,
.b {
  padding: 14rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.a {
  color: #166534;
  background: #dcfce7;
}

.b {
  color: #9f1239;
  background: #ffe4e6;
}
</style>
