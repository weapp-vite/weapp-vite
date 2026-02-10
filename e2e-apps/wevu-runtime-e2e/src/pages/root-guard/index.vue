<script setup lang="ts">
import { nextTick, ref } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

defineProps<{
  root: { a: string }
}>()

const __e2e = ref({
  ok: false,
  checks: {},
} as any)

const __e2eText = ref('')

async function _runE2E() {
  await nextTick()

  const currentPages = getCurrentPages() as any[]
  const current = currentPages[currentPages.length - 1] as any
  const data = current?.data || {}

  const classBindingEntries = Object.entries(data).filter(([key]) => /^__wv_cls_\d+$/.test(key))
  const classValues = classBindingEntries
    .map(([, value]) => (typeof value === 'string' ? value : ''))

  const checks = {
    classBindingGenerated: classBindingEntries.length > 0,
    classBindingSafeString: classValues.every(value => typeof value === 'string'),
  }

  const result = buildResult('root-guard', checks, {
    classBindingEntries,
  })

  __e2e.value = result
  __e2eText.value = stringifyResult(result)

  return result
}
</script>

<template>
  <view class="page">
    <view class="title">
      Root Guard Class
    </view>
    <view class="summary">
      ok: {{ __e2e.ok }}
    </view>

    <view v-if="root" id="root-guard-inline" :class="root.a">
      root-guard-inline
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
