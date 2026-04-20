<script setup lang="ts">
import SourceMapProbe from '../../components/issue-475/SourceMapProbe/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-475',
})

const pageLabel = 'issue-475 vue sourcemap debugging'
const pageTraceLabel = 'issue-475 page marker'

function _runE2E() {
  return {
    pageLabel,
    pageTraceLabel,
  }
}
</script>

<template>
  <view class="issue475-page">
    <text class="issue475-page__title">{{ pageLabel }}</text>
    <text class="issue475-page__trace">{{ pageTraceLabel }}</text>
    <SourceMapProbe />
  </view>
</template>

<style scoped>
.issue475-page {
  padding: 32rpx;
}

.issue475-page__title {
  display: block;
  margin-bottom: 24rpx;
}

.issue475-page__trace {
  display: block;
  margin-bottom: 24rpx;
}
</style>
