<script setup lang="ts">
import { shallowRef } from 'wevu'

definePageJson({
  navigationBarTitleText: 'App shell plain page',
})

definePageMeta({
  layout: false,
})

const count = shallowRef(0)

function increment() {
  count.value += 1
}
</script>

<template>
  <view id="app-shell-plain-page" class="app-shell-plain-page">
    <text id="app-shell-plain-title">APP-SHELL-PLAIN-PAGE</text>
    <text id="app-shell-plain-count">count: {{ count }}</text>
    <button id="app-shell-plain-increment" @tap="increment">
      increment
    </button>
  </view>
</template>

<style scoped>
.app-shell-plain-page {
  padding: 24rpx;
}
</style>
