<script setup lang="ts">
import { computed, onMounted, onPageScroll, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-404',
})

const scrollLogs = ref<number[]>([])
const hasInstanceOnPageScroll = ref(false)
const fillerItems = Array.from({ length: 48 }, (_, index) => `issue404 filler ${index + 1}`)

function syncPageHookState() {
  const page = getCurrentPages().at(-1) as { onPageScroll?: unknown } | undefined
  hasInstanceOnPageScroll.value = typeof page?.onPageScroll === 'function'
}

onMounted(() => {
  syncPageHookState()
})

onPageScroll((event) => {
  syncPageHookState()
  scrollLogs.value = [...scrollLogs.value.slice(-5), Number(event?.scrollTop ?? -1)]
})

const latestScrollTop = computed(() => scrollLogs.value.at(-1) ?? -1)

function _runE2E() {
  syncPageHookState()
  return {
    hasInstanceOnPageScroll: hasInstanceOnPageScroll.value,
    latestScrollTop: latestScrollTop.value,
    scrollLogs: [...scrollLogs.value],
  }
}
</script>

<template>
  <view class="issue404-page">
    <text class="issue404-title">issue-404 onPageScroll bridge</text>
    <text class="issue404-hook-state">has instance onPageScroll: {{ hasInstanceOnPageScroll ? 'yes' : 'no' }}</text>
    <text class="issue404-scroll-top">latest scrollTop: {{ latestScrollTop }}</text>
    <view
      v-for="item in fillerItems"
      :key="item"
      class="issue404-filler"
    >
      {{ item }}
    </view>
  </view>
</template>

<style scoped>
.issue404-page {
  padding: 32rpx;
}

.issue404-title,
.issue404-hook-state,
.issue404-scroll-top {
  display: block;
  margin-bottom: 24rpx;
}

.issue404-filler {
  height: 120rpx;
}
</style>
