export const defaultSfc = `<template>
  <view class="page">
    <view class="hero">
      <text class="eyebrow">
        wevu SFC playground
      </text>
      <text class="title">
        {{ heroTitle }}
      </text>
      <text class="subtitle">
        用一个可预览的 Vue SFC，覆盖 wevu 编译链最常见的页面写法。
      </text>
    </view>

    <view class="panel">
      <text class="section-title">
        交互输入
      </text>
      <input
        v-model="query"
        class="input"
        placeholder="筛选 capability，例如 model / layout"
      >

      <view class="toggle-row">
        <button class="chip" @tap="toggleOnlyActive">
          {{ onlyActive ? '只看 active' : '显示全部' }}
        </button>
        <button class="chip chip-ghost" @tap="cycleTone">
          tone: {{ tone }}
        </button>
        <button class="chip chip-ghost" @tap="addCapability">
          add item
        </button>
      </view>
    </view>

    <view class="summary-card" :class="[\`tone-\${tone}\`, { compact: onlyActive }]">
      <text class="summary-title">
        {{ summaryTitle }}
      </text>
      <text class="summary-copy">
        {{ summaryText }}
      </text>
      <text class="summary-meta">
        visible {{ filteredCapabilities.length }} / total {{ capabilities.length }}
      </text>
    </view>

    <view v-if="filteredCapabilities.length" class="capability-list">
      <view
        v-for="capability in filteredCapabilities"
        :key="capability.id"
        class="capability-card"
        :class="[
          \`tone-\${capability.tone}\`,
          {
            'is-active': capability.active,
            'is-featured': capability.featured,
          },
        ]"
        :style="{ animationDelay: \`\${capability.id * 40}ms\` }"
        @tap="toggleCapability(capability.id)"
      >
        <view class="card-head">
          <text class="card-title">
            {{ capability.name }}
          </text>
          <text class="card-state">
            {{ capability.active ? 'active' : 'idle' }}
          </text>
        </view>

        <text class="card-desc">
          {{ capability.description }}
        </text>

        <view class="tag-row">
          <text v-for="tag in capability.tags" :key="tag" class="tag">
            {{ tag }}
          </text>
        </view>

        <text v-if="capability.featured" class="card-footnote">
          这个条目额外展示了 :class、:style 与条件渲染的组合。
        </text>
        <text v-else class="card-footnote muted">
          点击卡片可切换 active 状态，观察 script / template 产物变化。
        </text>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-title">
        没有匹配结果
      </text>
      <text class="empty-copy">
        试试输入 model、template、style 等关键字。
      </text>
    </view>

    <view v-show="recentActions.length" class="panel">
      <text class="section-title">
        最近操作
      </text>
      <template v-for="(action, index) in recentActions" :key="action">
        <text class="log-line">
          {{ index + 1 }}. {{ action }}
        </text>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface CapabilityItem {
  id: number
  name: string
  description: string
  active: boolean
  featured?: boolean
  tone: 'mint' | 'amber' | 'sky'
  tags: string[]
}

const heroTitle = 'Vue directives in, wevu outputs out'
const query = ref('')
const onlyActive = ref(false)
const tone = ref<'mint' | 'amber' | 'sky'>('mint')
const nextId = ref(5)
const recentActions = ref<string[]>([
  '初始化 playground 示例',
])
const capabilities = ref<CapabilityItem[]>([
  {
    id: 1,
    name: 'template directives',
    description: '使用 v-if / v-else / v-for / v-show 等 Vue 模板语法，不出现 wx:* 指令。',
    active: true,
    featured: true,
    tone: 'mint',
    tags: ['v-if', 'v-for', 'v-show'],
  },
  {
    id: 2,
    name: 'reactive script',
    description: 'script setup + TypeScript + computed / ref，便于观察 wevu script transform。',
    active: true,
    tone: 'sky',
    tags: ['script setup', 'computed', 'ref'],
  },
  {
    id: 3,
    name: 'class and style binding',
    description: '卡片组合展示 :class 与 :style 的编译结果。',
    active: false,
    tone: 'amber',
    tags: [':class', ':style'],
  },
  {
    id: 4,
    name: 'config output',
    description: '保留 <json> 配置块，让 config tab 有真实页面配置可看。',
    active: true,
    tone: 'mint',
    tags: ['config', 'page'],
  },
])

const filteredCapabilities = computed(() => {
  const keyword = query.value.trim().toLowerCase()

  return capabilities.value.filter((item) => {
    const matchesKeyword = !keyword || [
      item.name,
      item.description,
      ...item.tags,
    ].join(' ').toLowerCase().includes(keyword)

    if (!matchesKeyword) {
      return false
    }

    return onlyActive.value ? item.active : true
  })
})

const summaryTitle = computed(() => {
  return onlyActive.value
    ? '当前聚焦 active capability'
    : '当前展示完整 capability list'
})

const summaryText = computed(() => {
  return filteredCapabilities.value.map(item => item.name).join(' / ')
})

function pushAction(message: string) {
  recentActions.value = [message, ...recentActions.value].slice(0, 4)
}

function toggleOnlyActive() {
  onlyActive.value = !onlyActive.value
  pushAction(onlyActive.value ? '切换为只看 active' : '切换为显示全部')
}

function cycleTone() {
  tone.value = tone.value === 'mint'
    ? 'amber'
    : tone.value === 'amber'
      ? 'sky'
      : 'mint'
  pushAction(\`summary tone -> \${tone.value}\`)
}

function toggleCapability(id: number) {
  capabilities.value = capabilities.value.map((item) => {
    if (item.id !== id) {
      return item
    }

    return {
      ...item,
      active: !item.active,
    }
  })

  pushAction(\`toggle capability #\${id}\`)
}

function addCapability() {
  const id = nextId.value
  nextId.value += 1
  capabilities.value = [
    ...capabilities.value,
    {
      id,
      name: \`dynamic capability \${id}\`,
      description: '动态追加的条目，用来观察列表 diff 与编译输出。',
      active: id % 2 === 0,
      tone: id % 3 === 0 ? 'amber' : id % 2 === 0 ? 'sky' : 'mint',
      tags: ['dynamic', 'list diff'],
    },
  ]
  pushAction(\`add capability #\${id}\`)
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 28rpx;
  background:
    radial-gradient(circle at top left, #f0fff6 0%, transparent 36%),
    linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
}

.hero,
.panel,
.summary-card,
.capability-card,
.empty-state {
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18rpx 42rpx rgba(37, 78, 120, 0.08);
}

.eyebrow {
  font-size: 20rpx;
  font-weight: 700;
  color: #179971;
  letter-spacing: 4rpx;
  text-transform: uppercase;
}

.title {
  margin-top: 10rpx;
  font-size: 44rpx;
  font-weight: 700;
  color: #102a43;
}

.subtitle,
.summary-copy,
.card-desc,
.card-footnote,
.empty-copy,
.log-line {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #52667a;
}

.section-title,
.summary-title,
.empty-title,
.card-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #102a43;
}

.input {
  height: 76rpx;
  margin-top: 16rpx;
  padding: 0 22rpx;
  font-size: 24rpx;
  color: #102a43;
  background: #f4f8fc;
  border-radius: 18rpx;
}

.toggle-row,
.tag-row,
.card-head {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
}

.toggle-row,
.tag-row {
  flex-wrap: wrap;
}

.toggle-row {
  margin-top: 16rpx;
}

.chip {
  min-width: 0;
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

.summary-card.compact {
  outline: 2rpx solid rgba(22, 163, 74, 0.22);
}

.summary-meta,
.card-state {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #6b7c8f;
}

.capability-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.capability-card {
  animation: card-in 320ms ease both;
}

.capability-card.is-active {
  transform: translateY(-2rpx);
}

.capability-card.is-featured {
  border: 2rpx solid rgba(16, 185, 129, 0.2);
}

.tag {
  padding: 6rpx 14rpx;
  font-size: 20rpx;
  color: #24506f;
  background: #eaf3ff;
  border-radius: 999rpx;
}

.muted {
  color: #7b8794;
}

.tone-mint {
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.98), rgba(245, 255, 251, 0.98));
}

.tone-amber {
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.98), rgba(255, 252, 245, 0.98));
}

.tone-sky {
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.98), rgba(247, 250, 255, 0.98));
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(10rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<json lang="json">
{
  "navigationBarTitleText": "wevu sfc playground",
  "navigationStyle": "default",
  "backgroundColor": "#eef4fb"
}
</json>
`
