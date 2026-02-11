<script setup lang="ts">
defineComponentJson({
  usingComponents: {
    InfoBanner: '/components/issue-289/InfoBanner/index',
  },
})
</script>

<template>
  <view class="block">
    <InfoBanner :root="{ a: 'aaaa' }" />
  </view>
</template>

<style scoped>
.block {
  margin-top: 20rpx;
}
</style>
