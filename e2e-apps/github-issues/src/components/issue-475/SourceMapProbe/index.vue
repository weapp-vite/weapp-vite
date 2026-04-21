<script setup lang="ts">
const componentLabel = 'issue-475 component marker'
const componentTraceLabel = componentLabel
const componentEnv = import.meta.env
const componentEnvLabel = componentEnv.VITE_ISSUE_475_LABEL

function _probeIssue475ComponentE2E() {
  return {
    componentEnv,
    componentLabel,
    componentTraceLabel,
    componentEnvLabel,
  }
}
</script>

<template>
  <view class="issue475-component">
    <text class="issue475-component__title">{{ componentLabel }}</text>
    <text class="issue475-component__trace">{{ componentTraceLabel }}</text>
    <text class="issue475-component__env">{{ componentEnvLabel }}</text>
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

.issue475-component__env {
  display: block;
}
</style>
