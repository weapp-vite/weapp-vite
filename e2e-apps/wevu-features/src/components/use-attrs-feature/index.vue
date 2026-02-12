<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { inject } from 'wevu'

const props = defineProps<{
  title: string
  stateClass?: string
  visible?: boolean | string | number
  badgeStyle?: string
  extraLabel?: string
  seedTag?: number | string
}>()

const attrs = useAttrs()
const propSource = props as Record<string, unknown>
const fallbackAttrNames = ['state-class', 'visible', 'badge-style', 'extra-label', 'seed-tag'] as const
const liveState = inject<Record<string, unknown> | null>('wevu-features:use-attrs-live', null)

function readLiveValue(key: string) {
  const source = liveState as Record<string, unknown> | null
  if (!source) {
    return undefined
  }
  const value = source[key]
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>).value
  }
  return value
}

function readAttrValue(name: string) {
  const camelName = name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
  const source = attrs as Record<string, unknown>
  return source[camelName] ?? source[name] ?? propSource[name] ?? propSource[camelName]
}

function stringifyValue(value: unknown) {
  if (value == null) {
    return String(value)
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const resolvedStateClass = computed(() => String(readLiveValue('toneClass') ?? readAttrValue('state-class') ?? 'tone-default'))
const resolvedBadgeStyle = computed(() => String(readLiveValue('badgeStyle') ?? readAttrValue('badge-style') ?? ''))
const visible = computed(() => {
  const raw = readLiveValue('visible') ?? readAttrValue('visible')
  if (raw === 'false' || raw === false || raw === 0 || raw === '0') {
    return false
  }
  return Boolean(raw)
})
const extraLabel = computed(() => String(readLiveValue('extraLabel') ?? readAttrValue('extra-label') ?? ''))
const attrRows = computed(() => {
  const attrEntries: Record<string, unknown> = {
    ...(attrs as Record<string, unknown>),
  }

  const liveFallbackEntries: Record<string, unknown> = {
    'state-class': readLiveValue('toneClass'),
    'badge-style': readLiveValue('badgeStyle'),
    'extra-label': readLiveValue('extraLabel'),
    'visible': readLiveValue('visible'),
  }

  for (const [key, value] of Object.entries(liveFallbackEntries)) {
    if (value != null) {
      attrEntries[key] = value
    }
  }

  for (const name of fallbackAttrNames) {
    if (attrEntries[name] != null) {
      continue
    }
    const value = readAttrValue(name)
    if (value != null) {
      attrEntries[name] = value
    }
  }

  return Object.entries(attrEntries)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}: ${stringifyValue(value)}`)
})
</script>

<template>
  <view class="use-attrs-feature">
    <view class="use-attrs-feature__title">
      {{ props.title }}
    </view>

    <view id="attrs-badge" class="use-attrs-feature__badge" :class="resolvedStateClass" :style="resolvedBadgeStyle">
      state-class = {{ resolvedStateClass }}
    </view>

    <view id="attrs-flag" class="use-attrs-feature__flag" :class="{ 'is-on': visible }">
      visible = {{ visible ? 'true' : 'false' }}
    </view>

    <view v-if="visible" id="attrs-extra" class="use-attrs-feature__extra">
      extra-label = {{ extraLabel }}
    </view>

    <view class="use-attrs-feature__rows">
      <view v-for="row in attrRows" :key="row" class="use-attrs-feature__row">
        {{ row }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.use-attrs-feature {
  margin-top: 22rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 2rpx solid #cbd5e1;
  background: #fff;
}

.use-attrs-feature__title {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.use-attrs-feature__badge {
  margin-top: 14rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
  color: #1e293b;
  background: #e2e8f0;
}

.use-attrs-feature__flag {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #64748b;
}

.use-attrs-feature__flag.is-on {
  color: #047857;
}

.use-attrs-feature__extra {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #0f766e;
}

.use-attrs-feature__rows {
  margin-top: 12rpx;
  padding: 12rpx;
  border-radius: 10rpx;
  background: #f1f5f9;
}

.use-attrs-feature__row {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: #334155;
  word-break: break-all;
}

.use-attrs-feature__row:first-child {
  margin-top: 0;
}

.tone-blue {
  color: #1d4ed8;
}

.tone-green {
  color: #047857;
}

.tone-orange {
  color: #c2410c;
}

.tone-default {
  color: #334155;
}
</style>
