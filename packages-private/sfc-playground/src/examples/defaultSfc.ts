export const defaultSfc = `<template>
  <view class="page">
    <input v-model="query" class="input" placeholder="search wevu feature">
    <view class="hero" @tap="showTips = !showTips">
      <text class="title">{{ title }}</text>
      <text v-if="showTips" class="tips">tap hero to toggle wx:if demo</text>
    </view>
    <text v-for="item in visibleItems" :key="item" class="card">{{ item }}</text>
  </view>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
const definePageJson = globalThis.definePageJson ?? ((_config: Record<string, unknown>) => {})
definePageJson({ navigationBarTitleText: 'wevu sfc playground' })
const query = ref('')
const showTips = ref(true)
const items = ['definePageJson', 'v-if', 'v-model']
const visibleItems = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return items.filter(item => item.toLowerCase().includes(keyword))
})
const title = computed(() => visibleItems.value.join(' / ') || 'wevu sfc')
</script>
<style scoped>
.page { display: flex; flex-direction: column; gap: 16rpx; padding: 24rpx; background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%); }
.input, .hero, .card { padding: 20rpx; border-radius: 20rpx; background: rgb(255 255 255 / 92%); }
.hero { color: #102a43; font-size: 28rpx; font-weight: 700; }
.tips { margin-top: 12rpx; font-size: 22rpx; color: #52667a; }
.input, .card { font-size: 24rpx; color: #52667a; }
</style>`
