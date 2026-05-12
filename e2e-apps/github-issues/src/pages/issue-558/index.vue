<script setup lang="ts">
import Cell from '../../components/issue-558/Cell/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-558',
})

function func(text: string = '') {
  return text.split('').reverse().join('')
}

const text = '123456789'

function _runE2E() {
  return {
    ok: true,
    expected: func(text),
  }
}
</script>

<template>
  <view class="issue558-page">
    <view class="issue558-title">
      issue-558 augmented slot computed binding
    </view>

    <Cell>
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
  background: #fff;
}

.issue558-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.issue558-result {
  font-size: 28rpx;
  color: #111827;
}
</style>
