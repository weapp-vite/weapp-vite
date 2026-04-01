export const defaultSfc = `<template>
  <view class="page">
    <view class="hero">
      <text class="eyebrow">
        wevu sfc
      </text>
      <text class="title">
        {{ headline }}
      </text>
      <text class="subtitle">
        单屏示例，展示推荐的 script setup + page macro + Vue 指令写法。
      </text>
    </view>

    <view class="panel">
      <input
        v-model="query"
        class="input"
        placeholder="搜索 directive / macro"
      >

      <view class="toolbar">
        <button class="chip" @tap="toggleOnlyEnabled">
          {{ onlyEnabled ? '只看 enabled' : '显示全部' }}
        </button>
        <button class="chip chip-ghost" @tap="cycleTone">
          tone: {{ tone }}
        </button>
      </view>
    </view>

    <view class="summary" :class="[\`tone-\${tone}\`, { compact: onlyEnabled }]">
      <text class="summary-title">
        {{ visibleCards.length }} capabilities
      </text>
      <text class="summary-copy">
        {{ summaryText }}
      </text>
    </view>

    <view v-if="visibleCards.length" class="card-list">
      <view
        v-for="card in visibleCards"
        :key="card.key"
        class="card"
        :class="[{ active: card.enabled }, \`tone-\${card.tone}\`]"
        @tap="toggleCard(card.key)"
      >
        <view class="card-head">
          <text class="card-title">
            {{ card.title }}
          </text>
          <text class="card-state">
            {{ card.enabled ? 'enabled' : 'idle' }}
          </text>
        </view>
        <text class="card-desc">
          {{ card.desc }}
        </text>
        <view class="tag-row">
          <text v-for="tag in card.tags" :key="tag" class="tag">
            {{ tag }}
          </text>
        </view>
      </view>
    </view>

    <view v-else class="empty">
      <text class="empty-title">
        没有匹配项
      </text>
      <text class="empty-copy">
        试试输入 model、macro、class。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const definePageJson = globalThis.definePageJson ?? ((_config: Record<string, unknown>) => {})

definePageJson({
  navigationBarTitleText: 'wevu sfc playground',
  backgroundColor: '#eef4fb',
})

interface DemoCard {
  key: string
  title: string
  desc: string
  enabled: boolean
  tone: 'mint' | 'sky' | 'amber'
  tags: string[]
}

const headline = 'Vue syntax in, wevu compile out'
const query = ref('')
const onlyEnabled = ref(false)
const tone = ref<'mint' | 'sky' | 'amber'>('mint')
const cards = ref<DemoCard[]>([
  {
    key: 'macro',
    title: 'page macro',
    desc: '使用 definePageJson 管理页面配置，而不是 <json> 块。',
    enabled: true,
    tone: 'mint',
    tags: ['definePageJson', 'script setup'],
  },
  {
    key: 'template',
    title: 'template directives',
    desc: '模板只使用 v-model、v-if、v-for、:class、@tap。',
    enabled: true,
    tone: 'sky',
    tags: ['v-model', 'v-if', 'v-for'],
  },
  {
    key: 'binding',
    title: 'reactive bindings',
    desc: '通过 computed + ref 组织状态，便于观察 script 与 template 产物。',
    enabled: false,
    tone: 'amber',
    tags: ['computed', ':class'],
  },
])

const visibleCards = computed(() => {
  const keyword = query.value.trim().toLowerCase()

  return cards.value.filter((card) => {
    const matched = !keyword || [
      card.title,
      card.desc,
      ...card.tags,
    ].join(' ').toLowerCase().includes(keyword)

    return matched && (!onlyEnabled.value || card.enabled)
  })
})

const summaryText = computed(() => {
  return visibleCards.value.map(card => card.title).join(' / ')
})

function toggleOnlyEnabled() {
  onlyEnabled.value = !onlyEnabled.value
}

function cycleTone() {
  tone.value = tone.value === 'mint'
    ? 'sky'
    : tone.value === 'sky'
      ? 'amber'
      : 'mint'
}

function toggleCard(key: string) {
  cards.value = cards.value.map((card) => {
    if (card.key !== key) {
      return card
    }

    return {
      ...card,
      enabled: !card.enabled,
    }
  })
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  min-height: 100vh;
  padding: 28rpx;
  background:
    radial-gradient(circle at top left, #effcf5 0%, transparent 34%),
    linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
}

.hero,
.panel,
.summary,
.card,
.empty {
  padding: 22rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18rpx 42rpx rgba(37, 78, 120, 0.08);
}

.eyebrow {
  font-size: 20rpx;
  font-weight: 700;
  color: #16926e;
  letter-spacing: 4rpx;
  text-transform: uppercase;
}

.title,
.summary-title,
.card-title,
.empty-title {
  color: #102a43;
}

.title {
  margin-top: 10rpx;
  font-size: 42rpx;
  font-weight: 700;
}

.subtitle,
.summary-copy,
.card-desc,
.empty-copy {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #52667a;
}

.input {
  height: 76rpx;
  padding: 0 22rpx;
  font-size: 24rpx;
  color: #102a43;
  background: #f4f8fc;
  border-radius: 18rpx;
}

.toolbar,
.card-head,
.tag-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.toolbar,
.tag-row,
.card-list {
  flex-wrap: wrap;
}

.toolbar {
  margin-top: 16rpx;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.chip {
  padding: 0 22rpx;
  font-size: 22rpx;
  line-height: 64rpx;
  color: #fff;
  background: linear-gradient(135deg, #1aa37a, #0f8a65);
  border-radius: 999rpx;
}

.chip-ghost {
  color: #14532d;
  background: #e9f8f0;
}

.summary.compact {
  outline: 2rpx solid rgba(22, 163, 74, 0.22);
}

.summary-title {
  font-size: 28rpx;
  font-weight: 700;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.card.active {
  transform: translateY(-2rpx);
}

.card-title {
  font-size: 28rpx;
  font-weight: 700;
}

.card-state {
  margin-left: auto;
  font-size: 22rpx;
  color: #6b7c8f;
}

.tag {
  padding: 6rpx 14rpx;
  font-size: 20rpx;
  color: #24506f;
  background: #eaf3ff;
  border-radius: 999rpx;
}

.tone-mint {
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.98), rgba(245, 255, 251, 0.98));
}

.tone-sky {
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.98), rgba(247, 250, 255, 0.98));
}

.tone-amber {
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.98), rgba(255, 252, 245, 0.98));
}
</style>
`
