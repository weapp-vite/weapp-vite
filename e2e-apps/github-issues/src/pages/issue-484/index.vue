<script setup lang="ts">
import { helperDefinedFlag, helperEnvSnapshot, helperSummary } from './define'

definePageJson({
  navigationBarTitleText: 'issue-484',
})

const pageDefinedFlag = import.meta.env.ISSUE_484_FLAG
const pageEnvSnapshot = JSON.stringify(import.meta.env)
const pageSummary = `issue-484 page define:${pageDefinedFlag}`

function _runE2E() {
  return {
    helperDefinedFlag,
    helperEnvSnapshot,
    helperSummary,
    pageDefinedFlag,
    pageEnvSnapshot,
    pageSummary,
  }
}
</script>

<template>
  <view class="issue484-page">
    <text class="issue484-title">issue-484 import.meta.env define override</text>
    <text class="issue484-line">{{ pageSummary }}</text>
    <text class="issue484-line">{{ helperSummary }}</text>
  </view>
</template>

<style scoped>
.issue484-page {
  padding: 32rpx;
}

.issue484-title,
.issue484-line {
  display: block;
  margin-bottom: 24rpx;
}
</style>
