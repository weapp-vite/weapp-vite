<script setup lang="ts">
import dayjs from 'dayjs'

definePageJson({
  navigationBarTitleText: 'issue-327-subpackage-npm',
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
  },
})

const today = dayjs('2026-03-10').format('YYYY-MM-DD')
</script>

<template>
  <view class="issue327-page">
    <text class="issue327-title">
      issue-327 subpackage npm output
    </text>
    <text class="issue327-date">
      {{ today }}
    </text>
    <t-button theme="primary">
      issue-327
    </t-button>
  </view>
</template>

<style scoped>
.issue327-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue327-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue327-date {
  display: block;
  margin: 16rpx 0 24rpx;
  font-size: 24rpx;
  color: #475569;
}
</style>
