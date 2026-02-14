<script setup lang="ts">
interface RowItem {
  id: string
  label: string
}

const dasd = 'dasd'
const rows: RowItem[] = [
  { id: 'row-0', label: 'Alpha' },
  { id: 'row-1', label: 'Beta' },
]

function sayHello(prefix: number, item: string, tail: string) {
  return `Hello-${prefix}-${item}-${tail}`
}

function shouldRenderList() {
  return true
}

function getRows() {
  return rows
}

function _runE2E() {
  const rendered = getRows().map(item => sayHello(1, item.label, dasd))
  return {
    ok: shouldRenderList()
      && rendered.length === 2
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
    <view
      class="issue297-bind"
      :data-title="sayHello(1, 'root', dasd)"
      :data-extra="sayHello(1, 'bind', dasd)"
    />
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
      </view>
    </view>
    <text
      v-else
      class="issue297-empty"
    >
      hidden
    </text>
  </view>
</template>

<style scoped>
.issue297-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue297-title {
  display: block;
  margin-top: 16rpx;
  color: #334155;
  font-size: 28rpx;
}

.issue297-bind {
  margin-top: 16rpx;
  height: 2rpx;
  opacity: 0.1;
}

.issue297-list {
  margin-top: 16rpx;
}

.issue297-row {
  margin-bottom: 10rpx;
  padding: 12rpx;
  border-radius: 12rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
}

.issue297-row-text,
.issue297-empty {
  display: block;
  color: #334155;
  font-size: 24rpx;
}
</style>
