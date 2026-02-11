<script setup lang="ts">
definePageJson({
  usingComponents: {
    ObjectLiteralExample: '/components/issue-289/ObjectLiteralExample/index',
    MapClassExample: '/components/issue-289/MapClassExample/index',
    RootClassExample: '/components/issue-289/RootClassExample/index',
    ComputedClassExample: '/components/issue-289/ComputedClassExample/index',
  },
})
</script>

<template>
  <view class="issue289-page">
    <ObjectLiteralExample />
    <MapClassExample />
    <RootClassExample />
    <ComputedClassExample />
  </view>
</template>

<style scoped>
.issue289-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f6f8fb;
}
</style>
