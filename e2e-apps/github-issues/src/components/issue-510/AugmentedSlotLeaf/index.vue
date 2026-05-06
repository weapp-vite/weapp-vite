<script setup lang="ts">
import { inject } from 'wevu'

const ISSUE_510_KEY = 'issue-510:slot-provide'
const injected = inject(ISSUE_510_KEY, 'issue-510-default')

defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue510-slot-leaf" data-issue510-leaf="true">
    issue-510 inject = {{ injected }}
  </view>
</template>

<style scoped>
.issue510-slot-leaf {
  font-size: 24rpx;
  color: #0f172a;
}
</style>
