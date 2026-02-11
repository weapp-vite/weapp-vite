<script setup lang="ts">
import ComputedClassExample from '../../components/issue-289/ComputedClassExample/index.vue'
import MapClassExample from '../../components/issue-289/MapClassExample/index.vue'
import ObjectLiteralExample from '../../components/issue-289/ObjectLiteralExample/index.vue'
import RootClassExample from '../../components/issue-289/RootClassExample/index.vue'
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
