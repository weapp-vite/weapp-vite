<script setup lang="ts">
import { onMounted } from 'wevu'

defineComponentJson({
  component: true,
})

const issue398FooterLabel = 'issue-398 footer'

onMounted(() => {})
</script>

<template>
  <view class="issue-398-footer">
    <text>{{ issue398FooterLabel }}</text>
  </view>
</template>

<style>
.issue-398-footer {
  padding: 16rpx;
  background: #cbd5e1;
}
</style>
