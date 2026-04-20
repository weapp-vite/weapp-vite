<script setup lang="ts">
const componentLabel = 'issue-475 component marker'
const componentTraceLabel = componentLabel

function _probeIssue475ComponentE2E() {
  return {
    componentLabel,
    componentTraceLabel,
  }
}
</script>

<template>
  <view class="issue475-component">
    <text class="issue475-component__title">{{ componentLabel }}</text>
    <text class="issue475-component__trace">{{ componentTraceLabel }}</text>
  </view>
</template>

<style scoped>
.issue475-component {
  padding: 16rpx;
}

.issue475-component__title {
  display: block;
}

.issue475-component__trace {
  display: block;
}
</style>
