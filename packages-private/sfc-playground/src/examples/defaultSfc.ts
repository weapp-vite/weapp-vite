export const defaultSfc = `<template>
  <view class="page">
    <input v-model="query" class="input" placeholder="search macro / model">
    <view class="hero" :class="[\`tone-\${tone}\`, { active: onlyEnabled }]">
      <text class="title">{{ summary }}</text>
      <button class="button" @tap="toggleOnlyEnabled">{{ onlyEnabled ? 'enabled only' : 'show all' }}</button>
    </view>
    <view v-for="item in visibleItems" :key="item.key" class="card" @tap="toggleItem(item.key)">
      <text>{{ item.title }} · {{ item.enabled ? 'enabled' : 'idle' }}</text>
    </view>
    <text v-if="!visibleItems.length" class="empty">no match</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
const definePageJson = globalThis.definePageJson ?? ((_config: Record<string, unknown>) => {})
definePageJson({ navigationBarTitleText: 'wevu sfc playground', backgroundColor: '#eef4fb' })
const query = ref(''); const onlyEnabled = ref(false); const tone = ref<'mint' | 'sky'>('mint')
const items = ref([{ key: 'macro', title: 'definePageJson', enabled: true }, { key: 'model', title: 'v-model + computed', enabled: true }, { key: 'class', title: ':class + @tap', enabled: false }])
const visibleItems = computed(() => items.value.filter(item => (!onlyEnabled.value || item.enabled) && (!query.value.trim() || item.title.toLowerCase().includes(query.value.trim().toLowerCase()))))
const summary = computed(() => visibleItems.value.map(item => item.title).join(' / ') || 'wevu sfc')
function toggleOnlyEnabled() { onlyEnabled.value = !onlyEnabled.value; tone.value = tone.value === 'mint' ? 'sky' : 'mint' }
function toggleItem(key: string) { items.value = items.value.map(item => item.key === key ? { ...item, enabled: !item.enabled } : item) }
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16rpx; min-height: 100vh; padding: 24rpx; background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%); }
.input,.hero,.card { padding: 20rpx; border-radius: 20rpx; background: rgb(255 255 255 / 92%); }
.hero { display: flex; gap: 16rpx; align-items: center; justify-content: space-between; }
.title,.empty { color: #102a43; font-size: 28rpx; font-weight: 700; }
.button { padding: 0 18rpx; line-height: 56rpx; color: #fff; background: #16926e; border-radius: 999rpx; }
.card,.input { color: #52667a; font-size: 24rpx; }
.tone-mint { outline: 2rpx solid rgb(22 146 110 / 18%); }
.tone-sky { outline: 2rpx solid rgb(14 116 144 / 18%); }
.active { transform: translateY(-2rpx); }
</style>
`
