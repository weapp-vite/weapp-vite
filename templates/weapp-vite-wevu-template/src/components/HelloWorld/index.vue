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

interface FeatureItem {
  id: string
  title: string
  group: 'core' | 'template' | 'engineering'
  done?: boolean
  level?: 'base' | 'advanced'
}

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    highlights?: HighlightItem[]
    features?: FeatureItem[]
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
  (e: 'action', payload: { type: 'toggle' | 'copy' | 'select' | 'stats', value?: string }): void
}>()

const expanded = ref(true)
const keyword = ref('')
const activeGroup = ref<'all' | FeatureItem['group']>('all')
const selectedFeatureId = ref('')
const searchHit = ref(0)
const searchMiss = ref(0)

watch(
  () => props.features,
  (nextFeatures) => {
    if (!nextFeatures.length) {
      selectedFeatureId.value = ''
      return
    }

    const exists = nextFeatures.some(feature => feature.id === selectedFeatureId.value)
    if (!selectedFeatureId.value || !exists) {
      selectedFeatureId.value = nextFeatures[0]?.id ?? ''
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
  return props.features.filter((feature) => {
    const matchGroup = activeGroup.value === 'all' || feature.group === activeGroup.value
    if (!matchGroup) {
      return false
    }
    if (!normalized) {
      return true
    }
    return feature.title.toLowerCase().includes(normalized)
  })
})

const selectedFeature = computed(() => {
  return props.features.find(feature => feature.id === selectedFeatureId.value)
})

const stats = computed(() => {
  const total = props.features.length
  const done = props.features.filter(feature => feature.done).length
  const advanced = props.features.filter(feature => feature.level === 'advanced').length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  return {
    total,
    done,
    advanced,
    progress,
  }
})

const completionText = computed(() => {
  return `${stats.value.done}/${stats.value.total} · ${stats.value.progress}%`
})

const groupTabs = computed(() => {
  const base = [
    { key: 'all', label: '全部' },
    { key: 'core', label: '核心' },
    { key: 'template', label: '模板' },
    { key: 'engineering', label: '工程化' },
  ] as const
  return base
})

watch(
  [keyword, filteredFeatures],
  () => {
    if (!keyword.value.trim()) {
      return
    }
    if (filteredFeatures.value.length > 0) {
      searchHit.value += 1
      return
    }
    searchMiss.value += 1
  },
)

watch(
  () => stats.value.progress,
  (progress) => {
    emit('action', { type: 'stats', value: String(progress) })
  },
  { immediate: true },
)

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

function selectGroup(group: 'all' | FeatureItem['group']) {
  activeGroup.value = group
}

function selectFeature(feature: FeatureItem) {
  selectedFeatureId.value = feature.id
  emit('action', { type: 'select', value: feature.title })
}

function copySelected() {
  if (!selectedFeature.value) {
    return
  }
  emit('action', { type: 'copy', value: selectedFeature.value.title })
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
        <text class="summary">
          完成度：{{ completionText }}
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

      <view class="group-tabs">
        <view
          v-for="tab in groupTabs"
          :key="tab.key"
          class="group-tab"
          :class="tab.key === activeGroup ? 'group-tab-active' : ''"
          @tap="selectGroup(tab.key)"
        >
          {{ tab.label }}
        </view>
      </view>

      <view class="chips">
        <view
          v-for="feature in filteredFeatures"
          :key="feature.id"
          class="chip"
          :class="feature.id === selectedFeatureId ? 'chip-active' : ''"
          @tap="selectFeature(feature)"
        >
          {{ feature.title }}
        </view>
      </view>

      <view class="search-stat">
        <text>
          搜索命中：{{ searchHit }}
        </text>
        <text>
          未命中：{{ searchMiss }}
        </text>
      </view>

      <view v-if="selectedFeature" class="selected-card">
        <text class="selected-label">
          当前焦点
        </text>
        <text class="selected-value">
          {{ selectedFeature.title }}
        </text>
        <text class="selected-meta">
          分组：{{ selectedFeature.group }} ｜ 等级：{{ selectedFeature.level ?? 'base' }}
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

.group-tabs {
  display: flex;
  gap: 10rpx;
  margin-top: 14rpx;
}

.group-tab {
  padding: 8rpx 14rpx;
  font-size: 22rpx;
  color: #596090;
  background: #f0f3ff;
  border-radius: 999rpx;
}

.group-tab-active {
  color: #fff;
  background: #4f5ee3;
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

.selected-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #7b82b1;
}

.search-stat {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
  font-size: 20rpx;
  color: #6d74a5;
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
