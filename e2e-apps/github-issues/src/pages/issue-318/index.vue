<script setup lang="ts">
import { computed, ref } from 'wevu'

interface Issue318Row {
  id: string
  label: string
}

definePageJson({
  navigationBarTitleText: 'issue-318',
  backgroundColor: '#ffffff',
})

const count = ref(1)
const list = ref<Issue318Row[]>([
  { id: 'row-0', label: 'Alpha' },
  { id: 'row-1', label: 'Beta' },
])
const activeIndex = ref(0)

const activeRow = computed(() => {
  return list.value[activeIndex.value] ?? list.value[0]
})

function getRows() {
  return list.value
}

function formatRow(row: Issue318Row | undefined) {
  if (!row) {
    return 'empty'
  }
  return `${row.id}:${row.label}`
}

function formatMeta(currentCount: number, rowCount: number) {
  return `meta-${currentCount}-${rowCount}`
}

function shouldShowMeta() {
  return count.value >= 0
}

function incCount() {
  count.value += 1
}

function appendRow() {
  const index = list.value.length
  list.value = [
    ...list.value,
    {
      id: `row-${index}`,
      label: `Extra-${index}`,
    },
  ]
}

function cycleActive() {
  if (list.value.length === 0) {
    activeIndex.value = 0
    return
  }
  activeIndex.value = (activeIndex.value + 1) % list.value.length
}

function _runE2E() {
  const rows = getRows().map(row => formatRow(row))
  const meta = formatMeta(count.value, getRows().length)
  const active = formatRow(activeRow.value)
  return {
    ok: rows.length >= 2 && rows[0] === 'row-0:Alpha',
    count: count.value,
    active,
    rows,
    meta,
  }
}
</script>

<template>
  <view class="issue318-page">
    <text class="issue318-title">
      issue-318 auto setData pick from template
    </text>
    <text class="issue318-subtitle">
      验证 v-for 与调用表达式场景下的自动 pick 注入
    </text>

    <view class="issue318-toolbar">
      <view
        class="issue318-btn issue318-btn-inc"
        @tap="incCount"
      >
        count++
      </view>
      <view
        class="issue318-btn issue318-btn-add"
        @tap="appendRow"
      >
        append row
      </view>
      <view
        class="issue318-btn issue318-btn-cycle"
        @tap="cycleActive"
      >
        cycle active
      </view>
    </view>

    <view
      class="issue318-probe"
      :data-count="count"
      :data-size="list.length"
      :data-active="formatRow(activeRow)"
    >
      count: {{ count }} | size: {{ list.length }} | active: {{ formatRow(activeRow) }}
    </view>

    <view class="issue318-list">
      <view
        v-for="item in list"
        :key="item.id"
        class="issue318-row"
        :data-line="formatRow(item)"
      >
        <text class="issue318-row-text">
          {{ formatRow(item) }}
        </text>
      </view>
    </view>

    <view
      v-if="shouldShowMeta()"
      class="issue318-meta"
      :data-meta="formatMeta(count, list.length)"
    >
      {{ formatMeta(count, list.length) }}
    </view>
  </view>
</template>

<style scoped>
.issue318-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue318-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue318-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue318-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.issue318-btn {
  padding: 10rpx 16rpx;
  font-size: 22rpx;
  color: #fff;
  background: #0ea5e9;
  border-radius: 12rpx;
}

.issue318-probe {
  display: block;
  margin-top: 18rpx;
  font-size: 24rpx;
  color: #1e293b;
}

.issue318-list {
  margin-top: 16rpx;
}

.issue318-row {
  padding: 12rpx 14rpx;
  margin-bottom: 8rpx;
  background: #e2e8f0;
  border-radius: 10rpx;
}

.issue318-row-text {
  font-size: 24rpx;
  color: #0f172a;
}

.issue318-meta {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #0369a1;
}
</style>
