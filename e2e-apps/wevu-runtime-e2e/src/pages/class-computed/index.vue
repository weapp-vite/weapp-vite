<script setup lang="ts">
import { computed, nextTick, ref } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

function flattenClassValues(value: any): string[] {
  if (typeof value === 'string') {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.flatMap(item => flattenClassValues(item))
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(item => flattenClassValues(item))
  }
  return []
}

const events = ref([
  { id: 'event-0', isPublic: true },
  { id: 'event-1', isPublic: false },
])
const selectedEventIdx = ref(-1)
const isExpand = ref({
  callout: false,
})
const source = ref(false)
const computedValue = computed(() => Boolean(source.value))

const __e2e = ref({
  ok: false,
  checks: {},
} as any)
const __e2eText = ref('')

async function runE2E() {
  selectedEventIdx.value = 1
  isExpand.value.callout = true
  source.value = true

  await nextTick()

  const currentPages = getCurrentPages() as any[]
  const current = currentPages[currentPages.length - 1] as any
  const data = current?.data || {}
  const classBindingEntries = Object.entries(data).filter(([key]) => /^__wv_cls_\d+$/.test(key))
  const classValues = classBindingEntries.flatMap(([, value]) => flattenClassValues(value))

  const hasClassToken = (token: string) => classValues.some((value) => {
    if (typeof value !== 'string') {
      return false
    }
    return value.split(/\s+/).includes(token)
  })

  const checks = {
    selectedDarkClassResolved: hasClassToken('bg-theme-dark'),
    unselectedClassResolved: hasClassToken('bg-white'),
    computedTernaryClassResolved: hasClassToken('class-a') && !hasClassToken('class-b'),
  }

  const result = buildResult('class-computed', checks, {
    selectedEventIdx: data.selectedEventIdx,
    classBindingEntries,
    classValues,
  })

  __e2e.value = result
  __e2eText.value = stringifyResult(result)

  return result
}

const _runE2E = runE2E
</script>

<template>
  <view class="page">
    <view class="title">
      Class Computed
    </view>
    <view class="summary">
      ok: {{ __e2e.ok }}
    </view>

    <view id="computed-class-target" class="base" :class="computedValue ? 'class-a' : 'class-b'">
      computed-class-target
    </view>

    <view id="nested-ternary-list">
      <view
        v-for="(event, index) in events"
        :key="event.id"
        class="item"
        :class="[
          isExpand.callout ? 'expanded' : 'collapsed',
          selectedEventIdx === index ? (event.isPublic ? 'bg-highlight-dark' : 'bg-theme-dark') : 'bg-white',
        ]"
      >
        row-{{ index }}
      </view>
    </view>

    <text selectable class="details">
      {{ __e2eText }}
    </text>
  </view>
</template>

<style>
.page {
  padding: 20rpx;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
}

.summary {
  margin-top: 8rpx;
  color: #666;
}

.base {
  margin-top: 12rpx;
  border: 1rpx solid #d9d9d9;
}

.item {
  margin-top: 10rpx;
  border-radius: 12rpx;
  padding: 8rpx;
}

.details {
  display: block;
  margin-top: 16rpx;
}
</style>

<json>
{
  "component": false
}
</json>
