<script setup lang="ts">
import { onMounted } from 'wevu'

defineComponentJson({
  component: true,
})

const issue398NavbarLabel = 'issue-398 navbar'

onMounted(() => {})
</script>

<template>
  <view class="issue-398-navbar">
    <text>{{ issue398NavbarLabel }}</text>
  </view>
</template>

<style>
.issue-398-navbar {
  padding: 16rpx;
  background: #e2e8f0;
}
</style>
