<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(0)
function increment() {
  count.value += 1
}
</script>

<template>
  <view class="initial-style-page" id="initial-style-root">
    <style-probe :style="{ color: count ? 'blue' : 'red' }" :count="count" @increment="increment" />
    <text id="initial-style-count">{{ count }}</text>
  </view>
</template>
