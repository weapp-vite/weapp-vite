<script setup lang="ts">
import axios from 'axios'

definePageJson({
  navigationBarTitleText: 'issue-764',
})

definePageMeta({
  layout: false,
})

const axiosAdapterReady = typeof axios.request === 'function'
</script>

<template>
  <view id="issue-764-page" class="issue-764-page" :data-axios-ready="axiosAdapterReady ? 'true' : 'false'">
    <text class="issue-764-title">issue-764 axios runtime</text>
    <text class="issue-764-status">axiosReady = {{ axiosAdapterReady }}</text>
  </view>
</template>

<style>
.issue-764-page {
  min-height: 100vh;
  padding: 32rpx;
}

.issue-764-title,
.issue-764-status {
  display: block;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  line-height: 1.5;
}
</style>
