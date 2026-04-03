<script setup lang="ts">
import BaseFooter from '../components/issue-398/BaseFooter/index.vue'
import BaseNavbar from '../components/issue-398/BaseNavbar/index.vue'

defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue-398-shell">
    <BaseNavbar />
    <view class="issue-398-shell__body">
      <slot />
    </view>
    <BaseFooter />
  </view>
</template>

<style>
.issue-398-shell {
  min-height: 100%;
  padding: 24rpx;
}

.issue-398-shell__body {
  margin: 20rpx 0;
}
</style>
