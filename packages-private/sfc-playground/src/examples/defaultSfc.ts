export const defaultSfc = `<template>
  <view class="page">
    <input v-model="query" class="input" placeholder="search macro / model">
    <view class="hero" :class="{ active: onlyEnabled }" @tap="toggleOnlyEnabled">
      <text class="title">{{ summary }}</text>
    </view>
    <text v-for="item in visibleItems" :key="item" class="card">{{ item }}</text>
  </view>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
const definePageJson = globalThis.definePageJson ?? ((_config: Record<string, unknown>) => {})
definePageJson({ navigationBarTitleText: 'wevu sfc playground' })
const query = ref('')
const onlyEnabled = ref(false)
const items = ['definePageJson', 'v-model', ':class + @tap']
const visibleItems = computed(() => items.filter(item => (!onlyEnabled.value || item !== ':class + @tap') && item.toLowerCase().includes(query.value.trim().toLowerCase())))
const summary = computed(() => visibleItems.value.join(' / ') || 'wevu sfc')
const toggleOnlyEnabled = () => { onlyEnabled.value = !onlyEnabled.value }
</script>
<style scoped>
.page { display: flex; flex-direction: column; gap: 16rpx; padding: 24rpx; background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%); }
.input, .hero, .card { padding: 20rpx; border-radius: 20rpx; background: rgb(255 255 255 / 92%); }
.hero { color: #102a43; font-size: 28rpx; font-weight: 700; }
.input, .card { font-size: 24rpx; color: #52667a; }
.active { transform: translateY(-2rpx); }
</style>
`
