<script setup lang="ts">
import { computed, ref } from 'wevu'

interface RowItem {
  id: string
  label: string
}

const dasd = 'dasd'

const baseRows: RowItem[] = [
  { id: 'row-0', label: 'Alpha' },
  { id: 'row-1', label: 'Beta' },
]

const rows = ref<RowItem[]>([...baseRows])
const showBindCase = ref(true)
const showListCase = ref(true)
const showInlineCase = ref(true)
const activeIndex = ref(0)
const tapCount = ref(0)
const eventLogs = ref<string[]>([])

const activeRow = computed(() => {
  return rows.value[activeIndex.value] ?? rows.value[0] ?? baseRows[0]
})
const activeRowId = computed(() => activeRow.value.id)
const activeRowLabel = computed(() => activeRow.value.label)

function sayHello(prefix: number, item: string, tail: string) {
  return `Hello-${prefix}-${item}-${tail}`
}

function getRows() {
  return rows.value
}

function shouldRenderList() {
  return showListCase.value
}

function appendLog(action: string, detail: string) {
  tapCount.value += 1
  const message = `#${tapCount.value} ${action} -> ${detail}`
  eventLogs.value = [message, ...eventLogs.value].slice(0, 8)
  // eslint-disable-next-line no-console
  console.info('[issue-297]', action, detail, {
    tapCount: tapCount.value,
    showBindCase: showBindCase.value,
    showListCase: showListCase.value,
    showInlineCase: showInlineCase.value,
    activeRow: activeRowId.value,
    rowsCount: rows.value.length,
  })
}

function toggleBindCase() {
  showBindCase.value = !showBindCase.value
  appendLog('toggleBindCase', showBindCase.value ? 'show' : 'hide')
}

function toggleListCase() {
  showListCase.value = !showListCase.value
  appendLog('toggleListCase', showListCase.value ? 'show' : 'hide')
}

function toggleInlineCase() {
  showInlineCase.value = !showInlineCase.value
  appendLog('toggleInlineCase', showInlineCase.value ? 'show' : 'hide')
}

function cycleActive() {
  if (rows.value.length === 0) {
    activeIndex.value = 0
    appendLog('cycleActive', 'rows empty')
    return
  }
  activeIndex.value = (activeIndex.value + 1) % rows.value.length
  appendLog('cycleActive', activeRowId.value)
}

function appendRow() {
  const index = rows.value.length
  rows.value = [...rows.value, {
    id: `row-${index}`,
    label: `Extra-${index}`,
  }]
  appendLog('appendRow', `row-${index}`)
}

function resetRows() {
  rows.value = [...baseRows]
  if (activeIndex.value >= rows.value.length) {
    activeIndex.value = 0
  }
  appendLog('resetRows', `rows=${rows.value.length}`)
}

function _runE2E() {
  const rendered = baseRows.map(item => sayHello(1, item.label, dasd))
  return {
    ok: rendered.length === 2
      && rendered[0] === 'Hello-1-Alpha-dasd'
      && rendered[1] === 'Hello-1-Beta-dasd',
    rendered,
    root: sayHello(1, 'root', dasd),
  }
}
</script>

<template>
  <view class="issue297-page">
    <text class="issue297-title">
      issue-297 complex call expressions
    </text>
    <text class="issue297-subtitle">
      交互演示：每个 Case 都直接展示调用表达式在模板中的渲染结果
    </text>

    <view class="issue297-toolbar">
      <view class="issue297-btn" @tap="toggleBindCase">
        Case A(v-bind): {{ showBindCase ? '显示' : '隐藏' }}
      </view>
      <view class="issue297-btn" @tap="toggleListCase">
        Case B(v-if/v-for): {{ showListCase ? '显示' : '隐藏' }}
      </view>
      <view class="issue297-btn" @tap="toggleInlineCase">
        Case C(多参数): {{ showInlineCase ? '显示' : '隐藏' }}
      </view>
      <view class="issue297-btn" @tap="cycleActive">
        切换激活项: {{ activeRowId }}
      </view>
      <view class="issue297-btn" @tap="appendRow">
        新增列表项
      </view>
      <view class="issue297-btn" @tap="resetRows">
        重置列表
      </view>
    </view>

    <view class="issue297-state">
      <text class="issue297-state-text">
        rows: {{ getRows().length }}
      </text>
      <text class="issue297-state-text">
        active: {{ activeRowLabel }}
      </text>
      <text class="issue297-state-text">
        tapCount: {{ tapCount }}
      </text>
      <text class="issue297-state-text">
        tail: {{ dasd }}
      </text>
    </view>

    <view class="issue297-logs">
      <text class="issue297-logs-title">
        点击日志（最新 8 条）
      </text>
      <text
        v-if="eventLogs.length === 0"
        class="issue297-log-empty"
      >
        暂无日志，请点击上方按钮
      </text>
      <view
        v-for="line in eventLogs"
        :key="line"
        class="issue297-log-item"
      >
        {{ line }}
      </view>
    </view>

    <view
      v-if="showBindCase"
      class="issue297-case issue297-case-bind"
    >
      <text class="issue297-case-title">
        Case A · v-bind 调用表达式
      </text>
      <text class="issue297-case-code">
        :data-title 使用三参数函数调用结果
      </text>
      <view
        class="issue297-bind"
        :data-title="sayHello(1, 'root', dasd)"
        :data-extra="sayHello(1, 'bind', dasd)"
      >
        <text class="issue297-case-result">
          {{ sayHello(1, 'root', dasd) }}
        </text>
      </view>
    </view>

    <view class="issue297-case issue297-case-list">
      <text class="issue297-case-title">
        Case B · v-if + v-for 调用表达式
      </text>
      <text class="issue297-case-code">
        v-if="shouldRenderList()" / v-for="item in getRows()"
      </text>

      <view
        v-if="shouldRenderList()"
        class="issue297-list"
      >
        <view
          v-for="item in getRows()"
          :key="item.id"
          class="issue297-row"
          :data-hello="sayHello(1, item.label, dasd)"
        >
          <text class="issue297-row-text">
            {{ sayHello(1, item.label, dasd) }}
          </text>
          <text class="issue297-row-subtext">
            {{ sayHello(1, item.id, dasd) }}
          </text>
        </view>
      </view>
      <view
        v-else
        class="issue297-empty"
      >
        <text class="issue297-empty-text">
          列表已隐藏: {{ sayHello(1, 'hidden', dasd) }}
        </text>
      </view>
    </view>

    <view
      v-if="showInlineCase"
      class="issue297-case issue297-case-inline"
    >
      <text class="issue297-case-title">
        Case C · 多参数调用（含激活项）
      </text>
      <text class="issue297-case-code">
        三参数函数调用 + 激活项联动
      </text>
      <text class="issue297-case-result">
        {{ sayHello(1, activeRowLabel, dasd) }}
      </text>
      <text class="issue297-case-result">
        {{ sayHello(1, `${activeRowId}-meta`, dasd) }}
      </text>
    </view>
  </view>
</template>

<style scoped>
.issue297-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f1f5f9;
}

.issue297-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue297-subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue297-toolbar {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.issue297-btn {
  min-height: 56rpx;
  padding: 0 16rpx;
  margin: 6rpx;
  font-size: 22rpx;
  line-height: 56rpx;
  color: #1f2937;
  background: #e2e8f0;
  border-radius: 9999rpx;
}

.issue297-state {
  padding: 12rpx 14rpx;
  margin-top: 12rpx;
  background: #fff;
  border: 1rpx dashed #94a3b8;
  border-radius: 12rpx;
}

.issue297-state-text {
  display: block;
  font-size: 22rpx;
  color: #334155;
}

.issue297-logs {
  padding: 12rpx 14rpx;
  margin-top: 12rpx;
  background: #0f172a;
  border: 1rpx solid #1e293b;
  border-radius: 12rpx;
}

.issue297-logs-title {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: #e2e8f0;
}

.issue297-log-empty {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #cbd5e1;
}

.issue297-log-item {
  padding: 8rpx 10rpx;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #f8fafc;
  background: #1e293b;
  border-radius: 8rpx;
}

.issue297-case {
  padding: 16rpx;
  margin-top: 14rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 14rpx;
}

.issue297-case-bind {
  border-color: #2563eb;
}

.issue297-case-list {
  border-color: #16a34a;
}

.issue297-case-inline {
  border-color: #f59e0b;
}

.issue297-case-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #0f172a;
}

.issue297-case-code {
  display: block;
  padding: 8rpx 10rpx;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #475569;
  background: #f8fafc;
  border-radius: 10rpx;
}

.issue297-bind {
  margin-top: 10rpx;
}

.issue297-list {
  margin-top: 10rpx;
}

.issue297-row {
  padding: 10rpx 12rpx;
  margin-bottom: 10rpx;
  background: #f8fafc;
  border: 1rpx solid #cbd5e1;
  border-radius: 12rpx;
}

.issue297-row-text {
  display: block;
  font-size: 23rpx;
  color: #0f172a;
}

.issue297-row-subtext {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #64748b;
}

.issue297-case-result,
.issue297-empty-text {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #334155;
}

.issue297-empty {
  padding: 10rpx 12rpx;
  margin-top: 10rpx;
  background: #fee2e2;
  border: 1rpx solid #fca5a5;
  border-radius: 12rpx;
}
</style>
