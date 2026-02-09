<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

type HighlightTone = 'up' | 'down' | 'flat'

interface HighlightItem {
  key: string
  label: string
  value: string | number
  tone?: HighlightTone
  note?: string
}

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    highlights?: HighlightItem[]
    features?: string[]
    compact?: boolean
  }>(),
  {
    title: 'Hello WeVU',
    subtitle: '',
    highlights: () => [],
    features: () => [],
    compact: false,
  },
)

const emit = defineEmits<{
  (e: 'action', payload: { type: 'toggle' | 'copy', value?: string }): void
}>()

const expanded = ref(true)
const keyword = ref('')
const selectedFeature = ref('')

watch(
  () => props.features,
  (nextFeatures) => {
    if (!nextFeatures.length) {
      selectedFeature.value = ''
      return
    }

    if (!selectedFeature.value || !nextFeatures.includes(selectedFeature.value)) {
      selectedFeature.value = nextFeatures[0] ?? ''
    }
  },
  { immediate: true },
)

const panelClass = computed(() => {
  return props.compact ? 'hello-panel hello-panel-compact' : 'hello-panel'
})

const summaryText = computed(() => {
  return `${props.highlights.length} 个指标 · ${props.features.length} 条能力`
})

const filteredFeatures = computed(() => {
  const normalized = keyword.value.trim().toLowerCase()
  if (!normalized) {
    return props.features
  }
  return props.features.filter(feature => feature.toLowerCase().includes(normalized))
})

function toneClass(tone?: HighlightTone) {
  if (tone === 'up') {
    return 'metric-value metric-up'
  }
  if (tone === 'down') {
    return 'metric-value metric-down'
  }
  return 'metric-value metric-flat'
}

function toggleExpand() {
  expanded.value = !expanded.value
  emit('action', { type: 'toggle', value: String(expanded.value) })
}

function selectFeature(feature: string) {
  selectedFeature.value = feature
}

function copySelected() {
  if (!selectedFeature.value) {
    return
  }
  emit('action', { type: 'copy', value: selectedFeature.value })
}
</script>

<template>
  <view :class="panelClass">
    <view class="head-row">
      <view class="head-main">
        <text class="title">
          {{ props.title }}
        </text>
        <text v-if="props.subtitle" class="subtitle">
          {{ props.subtitle }}
        </text>
        <text class="summary">
          {{ summaryText }}
        </text>
      </view>
      <button class="tiny-btn" @tap.stop="toggleExpand">
        {{ expanded ? '收起' : '展开' }}
      </button>
    </view>

    <view v-if="expanded" class="panel-body">
      <view v-if="props.highlights.length" class="metrics">
        <view v-for="item in props.highlights" :key="item.key" class="metric-item">
          <text class="metric-label">
            {{ item.label }}
          </text>
          <text :class="toneClass(item.tone)">
            {{ item.value }}
          </text>
          <text v-if="item.note" class="metric-note">
            {{ item.note }}
          </text>
        </view>
      </view>

      <view class="feature-toolbar">
        <input v-model="keyword" class="search-input" placeholder="筛选能力关键词…">
        <button class="tiny-btn tiny-btn-light" @tap.catch="copySelected">
          复制当前
        </button>
      </view>

      <view class="chips">
        <view
          v-for="feature in filteredFeatures"
          :key="feature"
          class="chip"
          :class="feature === selectedFeature ? 'chip-active' : ''"
          @tap="selectFeature(feature)"
        >
          {{ feature }}
        </view>
      </view>

      <view v-if="selectedFeature" class="selected-card">
        <text class="selected-label">
          当前焦点
        </text>
        <text class="selected-value">
          {{ selectedFeature }}
        </text>
      </view>

      <slot name="footer" />
    </view>
  </view>
</template>

<style>
.hello-panel {
  padding: 24rpx;
  margin-top: 20rpx;
  background: linear-gradient(180deg, #fff, #f8faff);
  border-radius: 24rpx;
  box-shadow: 0 10rpx 28rpx rgb(76 110 245 / 12%);
}

.hello-panel-compact {
  padding: 18rpx;
}

.head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.head-main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #2d2f6b;
}

.subtitle {
  display: block;
  font-size: 24rpx;
  color: #5b5f93;
}

.summary {
  display: block;
  font-size: 22rpx;
  color: #7b80af;
}

.panel-body {
  margin-top: 20rpx;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 14rpx;
  background: #fff;
  border: 2rpx solid #eef1ff;
  border-radius: 16rpx;
}

.metric-label {
  font-size: 22rpx;
  color: #6870a2;
}

.metric-value {
  font-size: 30rpx;
  font-weight: 700;
}

.metric-up {
  color: #1b7a3a;
}

.metric-down {
  color: #c92a2a;
}

.metric-flat {
  color: #3b3f73;
}

.metric-note {
  font-size: 20rpx;
  color: #8a90bd;
}

.feature-toolbar {
  display: flex;
  gap: 12rpx;
  align-items: center;
  margin-top: 16rpx;
}

.search-input {
  box-sizing: border-box;
  flex: 1;
  height: 68rpx;
  padding: 0 18rpx;
  margin: 0;
  font-size: 24rpx;
  background: #fff;
  border: 2rpx solid #e6e9f7;
  border-radius: 12rpx;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}

.chip {
  padding: 10rpx 16rpx;
  font-size: 22rpx;
  color: #4f5685;
  background: #edf1ff;
  border-radius: 999rpx;
}

.chip-active {
  color: #fff;
  background: #5b5ce2;
}

.selected-card {
  padding: 14rpx 16rpx;
  margin-top: 14rpx;
  background: #fff;
  border: 2rpx dashed #ccd4ff;
  border-radius: 14rpx;
}

.selected-label {
  display: block;
  font-size: 20rpx;
  color: #7c84b0;
}

.selected-value {
  display: block;
  margin-top: 4rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: #36407a;
}

.tiny-btn {
  min-width: 108rpx;
  height: 56rpx;
  padding: 0 16rpx;
  margin: 0;
  font-size: 22rpx;
  line-height: 56rpx;
  color: #fff;
  background: #5b5ce2;
  border-radius: 12rpx;
}

.tiny-btn-light {
  color: #4f5ee3;
  background: #edf0ff;
}

.tiny-btn::after {
  border: 0;
}
</style>
