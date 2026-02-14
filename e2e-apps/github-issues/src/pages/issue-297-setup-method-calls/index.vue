<script setup lang="ts">
import { computed, ref } from 'wevu'

interface CaseRow {
  id: string
  label: string
}

const rows = ref<CaseRow[]>([
  { id: 'row-0', label: 'Alpha' },
  { id: 'row-1', label: 'Beta' },
])
const activeIndex = ref(0)
const showCase = ref(true)
const showLoop = ref(true)
const optionalEnabled = ref(true)
const suffix = ref('tail')
const logCount = ref(0)
const logs = ref<string[]>([])

const activeRow = computed(() => {
  return rows.value[activeIndex.value] ?? rows.value[0]
})

const helpers = {
  upper(value: string) {
    return value.toUpperCase()
  },
  prefix() {
    return 'P'
  },
  wrap(value: string) {
    return `[${value}]`
  },
}

const optionalInvoker = ref<((value: string) => string) | undefined>((value: string) => {
  return `Maybe-${value}`
})

function getCase() {
  return '123'
}

function sayCase(prefix: string, item: string, tail: string) {
  return `${prefix}-${item}-${tail}`
}

function getRows() {
  return rows.value
}

function shouldShowCase() {
  return showCase.value
}

function shouldShowLoop() {
  return showLoop.value
}

function getOptionalInvoker() {
  return optionalInvoker.value
}

function appendLog(action: string, detail: string) {
  logCount.value += 1
  const line = `#${logCount.value} ${action} -> ${detail}`
  logs.value = [line, ...logs.value].slice(0, 8)
  console.info('[issue-297-setup-method-calls]', action, detail, {
    activeRow: activeRow.value?.id,
    rowsCount: rows.value.length,
    showCase: showCase.value,
    showLoop: showLoop.value,
    optionalEnabled: optionalEnabled.value,
  })
}

function cycleActive() {
  if (rows.value.length === 0) {
    appendLog('cycleActive', 'rows empty')
    return
  }
  activeIndex.value = (activeIndex.value + 1) % rows.value.length
  appendLog('cycleActive', activeRow.value.id)
}

function appendRow() {
  const index = rows.value.length
  rows.value = [...rows.value, {
    id: `row-${index}`,
    label: `Extra-${index}`,
  }]
  appendLog('appendRow', `row-${index}`)
}

function toggleShowCase() {
  showCase.value = !showCase.value
  appendLog('toggleShowCase', showCase.value ? 'show' : 'hide')
}

function toggleShowLoop() {
  showLoop.value = !showLoop.value
  appendLog('toggleShowLoop', showLoop.value ? 'show' : 'hide')
}

function toggleOptionalInvoker() {
  optionalEnabled.value = !optionalEnabled.value
  optionalInvoker.value = optionalEnabled.value
    ? (value: string) => `Maybe-${value}`
    : undefined
  appendLog('toggleOptionalInvoker', optionalEnabled.value ? 'enabled' : 'disabled')
}

function _runE2E() {
  const loopValues = getRows().map(item => sayCase('loop', item.label, suffix.value))
  const inlineValue = getCase()
  const bindValue = sayCase('bind', activeRow.value.label, 'dasd')
  const ternaryValue = shouldShowCase()
    ? sayCase('ternary', activeRow.value.id, 'dasd')
    : 'closed'
  const templateLiteralValue = `${helpers.prefix()}-${getCase()}`
  const memberValue = helpers.upper(sayCase('member', activeRow.value.label, suffix.value))
  const optionalValue = getOptionalInvoker()?.(activeRow.value.id) ?? 'none'

  return {
    ok: inlineValue === '123'
      && bindValue === 'bind-Alpha-dasd'
      && loopValues[0] === 'loop-Alpha-tail'
      && templateLiteralValue === 'P-123'
      && memberValue === 'MEMBER-ALPHA-TAIL'
      && ternaryValue === 'ternary-row-0-dasd'
      && optionalValue === 'Maybe-row-0',
    inlineValue,
    bindValue,
    loopValues,
    ternaryValue,
    templateLiteralValue,
    memberValue,
    optionalValue,
  }
}
</script>

<template>
  <view class="issue297m-page">
    <text class="issue297m-title">
      issue-297 setup method call variants
    </text>
    <text class="issue297m-subtitle">
      覆盖插值、v-bind、v-if、v-for、成员调用、可选调用等写法
    </text>

    <view class="issue297m-toolbar">
      <view class="issue297m-btn" @tap="cycleActive">
        切换激活项: {{ activeRow.id }}
      </view>
      <view class="issue297m-btn" @tap="appendRow">
        新增列表项
      </view>
      <view class="issue297m-btn" @tap="toggleShowCase">
        切换 Case 区域: {{ showCase ? '显示' : '隐藏' }}
      </view>
      <view class="issue297m-btn" @tap="toggleShowLoop">
        切换循环区域: {{ showLoop ? '显示' : '隐藏' }}
      </view>
      <view class="issue297m-btn" @tap="toggleOptionalInvoker">
        可选调用: {{ optionalEnabled ? '启用' : '禁用' }}
      </view>
    </view>

    <view class="issue297m-state">
      <text class="issue297m-state-line">
        active: {{ activeRow.label }}
      </text>
      <text class="issue297m-state-line">
        rows: {{ getRows().length }}
      </text>
      <text class="issue297m-state-line">
        suffix: {{ suffix }}
      </text>
    </view>

    <view
      v-if="shouldShowCase()"
      class="issue297m-card"
    >
      <text class="issue297m-card-title">
        Case A · 插值调用 + 同级静态文本 + 同级元素
      </text>
      <view class="issue297m-inline-line">
        {{ getCase() }}11
        <view class="issue297m-inline-anchor">
          anchor
        </view>
      </view>
      <text class="issue297m-result">
        Case A value: {{ getCase() }}
      </text>
    </view>

    <view class="issue297m-card">
      <text class="issue297m-card-title">
        Case B · v-bind 多参数调用
      </text>
      <view
        class="issue297m-bind"
        :data-inline="getCase()"
        :data-multi="sayCase('bind', activeRow.label, 'dasd')"
      >
        <text class="issue297m-result">
          {{ sayCase('bind', activeRow.label, 'dasd') }}
        </text>
      </view>
    </view>

    <view class="issue297m-card">
      <text class="issue297m-card-title">
        Case C · v-if + v-for 调用表达式
      </text>
      <view
        v-if="shouldShowLoop()"
        class="issue297m-loop"
      >
        <view
          v-for="item in getRows()"
          :key="item.id"
          class="issue297m-loop-row"
          :data-label="sayCase('row', item.id, suffix)"
          :data-loop="sayCase('loop', item.label, suffix)"
        >
          <text class="issue297m-result">
            {{ sayCase('loop', item.label, suffix) }}
          </text>
        </view>
      </view>
      <view
        v-else
        class="issue297m-loop-empty"
      >
        <text class="issue297m-result">
          {{ sayCase('loop-hidden', activeRow.id, suffix) }}
        </text>
      </view>
    </view>

    <view class="issue297m-card">
      <text class="issue297m-card-title">
        Case D · 成员调用 / 模板字符串 / 三元表达式
      </text>
      <text class="issue297m-result">
        {{ helpers.upper(sayCase('member', activeRow.label, suffix)) }}
      </text>
      <text class="issue297m-result">
        {{ `${helpers.prefix()}-${getCase()}` }}
      </text>
      <text class="issue297m-result">
        {{ shouldShowCase() ? sayCase('ternary', activeRow.id, 'dasd') : 'closed' }}
      </text>
      <text class="issue297m-result">
        {{ helpers.wrap(sayCase('wrap', activeRow.id, suffix)) }}
      </text>
      <view
        class="issue297m-probe"
        :data-member="helpers.upper(sayCase('member', activeRow.label, suffix))"
        :data-template="`${helpers.prefix()}-${getCase()}`"
        :data-ternary="shouldShowCase() ? sayCase('ternary', activeRow.id, 'dasd') : 'closed'"
        :data-wrap="helpers.wrap(sayCase('wrap', activeRow.id, suffix))"
      />
    </view>

    <view class="issue297m-card">
      <text class="issue297m-card-title">
        Case E · 可选调用 + 空值兜底
      </text>
      <text class="issue297m-result">
        {{ getOptionalInvoker()?.(activeRow.id) ?? 'none' }}
      </text>
      <view class="issue297m-probe" :data-optional="getOptionalInvoker()?.(activeRow.id) ?? 'none'" />
    </view>

    <view class="issue297m-logs">
      <text class="issue297m-logs-title">
        点击日志（最新 8 条）
      </text>
      <text
        v-if="logs.length === 0"
        class="issue297m-log-empty"
      >
        暂无日志，请点击按钮
      </text>
      <view
        v-for="line in logs"
        :key="line"
        class="issue297m-log-item"
      >
        {{ line }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.issue297m-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.issue297m-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue297m-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue297m-toolbar {
  margin-top: 14rpx;
  display: flex;
  flex-wrap: wrap;
}

.issue297m-btn {
  margin: 6rpx;
  padding: 0 16rpx;
  min-height: 56rpx;
  line-height: 56rpx;
  border-radius: 9999rpx;
  background: #dbeafe;
  color: #1e3a8a;
  font-size: 22rpx;
}

.issue297m-state {
  margin-top: 12rpx;
  padding: 12rpx;
  border-radius: 12rpx;
  border: 1rpx dashed #94a3b8;
  background: #ffffff;
}

.issue297m-state-line {
  display: block;
  font-size: 22rpx;
  color: #334155;
}

.issue297m-card {
  margin-top: 12rpx;
  padding: 14rpx;
  border-radius: 12rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
}

.issue297m-card-title {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: #0f172a;
}

.issue297m-inline-line {
  margin-top: 8rpx;
  padding: 10rpx;
  border-radius: 8rpx;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 22rpx;
}

.issue297m-inline-anchor {
  margin-top: 8rpx;
  padding: 4rpx 10rpx;
  display: inline-flex;
  border-radius: 9999rpx;
  background: #bfdbfe;
}

.issue297m-bind,
.issue297m-loop-row,
.issue297m-loop-empty {
  margin-top: 8rpx;
}

.issue297m-result {
  display: block;
  margin-top: 8rpx;
  color: #1f2937;
  font-size: 22rpx;
}

.issue297m-probe {
  margin-top: 6rpx;
}

.issue297m-logs {
  margin-top: 14rpx;
  padding: 12rpx;
  border-radius: 12rpx;
  background: #0f172a;
}

.issue297m-logs-title {
  display: block;
  color: #e2e8f0;
  font-size: 22rpx;
  font-weight: 600;
}

.issue297m-log-empty {
  display: block;
  margin-top: 8rpx;
  color: #94a3b8;
  font-size: 20rpx;
}

.issue297m-log-item {
  margin-top: 8rpx;
  padding: 8rpx 10rpx;
  border-radius: 8rpx;
  background: #1e293b;
  color: #f8fafc;
  font-size: 20rpx;
}
</style>
