<script setup lang="ts">
import { nextTick, ref } from 'wevu'
import { buildResult, stringifyResult } from '../../shared/e2e'

const branch = ref<'if' | 'elseIf' | 'else'>('if')
const entries = ref<Array<[string, string]>>([
  ['name', 'runtime'],
  ['scope', 'e2e'],
])
const entryObjects = ref<Array<{ key: string, value: string }>>([
  { key: 'name', value: 'runtime' },
  { key: 'scope', value: 'e2e' },
])
const summaryMap = ref<Record<string, string>>({
  name: 'runtime',
  scope: 'e2e',
})

const __e2e = ref({
  ok: false,
  checks: {},
} as any)
const __e2eText = ref('')

async function runE2E() {
  branch.value = 'elseIf'
  entries.value = [
    ['name', 'runtime-e2e'],
    ['scope', 'template'],
  ]
  entryObjects.value = entries.value.map(([key, value]) => ({
    key,
    value,
  }))
  summaryMap.value = Object.fromEntries(entries.value)

  await nextTick()

  const currentPages = getCurrentPages() as any[]
  const current = currentPages[currentPages.length - 1] as any
  const data = current?.data || {}

  const checks = {
    elseIfBranchSelected: data.branch === 'elseIf',
    tupleEntriesUpdated: Array.isArray(data.entries) && data.entries[0]?.[0] === 'name' && data.entries[0]?.[1] === 'runtime-e2e',
    objectEntriesUpdated: Array.isArray(data.entryObjects) && data.entryObjects[0]?.key === 'name' && data.entryObjects[0]?.value === 'runtime-e2e',
    mapEntriesUpdated: data.summaryMap?.name === 'runtime-e2e' && data.summaryMap?.scope === 'template',
  }

  const result = buildResult('template-compat', checks, {
    branch: data.branch,
    entries: data.entries,
    entryObjects: data.entryObjects,
    summaryMap: data.summaryMap,
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
      Template Compat
    </view>
    <view class="summary">
      ok: {{ __e2e.ok }}
    </view>

    <view class="section">
      <text class="section-title">
        v-if / v-else-if / v-else
      </text>
      <view v-if="branch === 'if'" id="branch-if" class="row">
        if-branch
      </view>
      <view v-else-if="branch === 'elseIf'" id="branch-else-if" class="row">
        else-if-branch
      </view>
      <view v-else id="branch-else" class="row">
        else-branch
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        v-for tuple destructure
      </text>
      <view id="tuple-entries">
        <view v-for="([key, value], index) in entries" :key="key" class="row">
          <text>{{ index + 1 }}. {{ key }} = {{ value }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        v-for object destructure
      </text>
      <view id="object-entries">
        <view v-for="({ key, value }, index) in entryObjects" :key="key" class="row">
          <text>{{ index + 1 }}. {{ key }} = {{ value }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        v-for object map
      </text>
      <view id="map-entries">
        <view v-for="(value, key) in summaryMap" :key="key" class="row">
          <text>{{ key }} = {{ value }}</text>
        </view>
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

.section {
  margin-top: 12rpx;
}

.section-title {
  display: block;
  margin-bottom: 8rpx;
  color: #333;
}

.row {
  margin-top: 6rpx;
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
