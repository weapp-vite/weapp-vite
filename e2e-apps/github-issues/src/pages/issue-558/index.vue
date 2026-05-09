<script setup lang="ts">
import Cell from '../../components/issue-558/Cell/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-558',
})

const text = '123456789'

function func(value = '') {
  return value.split('').reverse().join('')
}

function _runE2E() {
  return {
    ok: func(text) === '987654321',
    expected: '987654321',
  }
}
</script>

<template>
  <view class="issue558-page">
    <view class="issue558-title">
      issue-558 scoped slot computed function
    </view>

    <Cell id="issue558-cell">
      <text class="issue558-result">
        {{ func(text) }}
      </text>
    </Cell>
  </view>
</template>

<style scoped>
.issue558-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #f8fafc;
}

.issue558-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue558-result {
  font-size: 28rpx;
  color: #0369a1;
}
</style>
