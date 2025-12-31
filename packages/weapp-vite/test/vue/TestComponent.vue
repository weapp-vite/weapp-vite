<script setup lang="ts">
import { computed, ref } from 'wevu'

const count = ref(0)
const doubled = computed(() => count.value * 2)

function increment() {
  count.value++
}
</script>

<template>
  <view class="counter">
    <text>Count: {{ count }}</text>
    <text>Doubled: {{ doubled }}</text>
    <button @tap="increment">
      +1
    </button>
    <view v-if="count > 5">
      Count is greater than 5!
    </view>
    <view v-else>
      Count is 5 or less
    </view>
    <view v-for="i in 3" :key="i">
      Item {{ i }}
    </view>
  </view>
</template>

<style>
.counter {
  padding: 20rpx;
}
text {
  display: block;
  margin: 10rpx 0;
}
</style>

<json>
{
  "component": true
}
</json>
