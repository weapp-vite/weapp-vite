<script setup lang="ts">
import AugmentedSlotHost from '../../components/issue-510/AugmentedSlotHost/index.vue'
import AugmentedSlotLeaf from '../../components/issue-510/AugmentedSlotLeaf/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-510',
})

function _runE2E() {
  return {
    ok: true,
    expected: 'augmented plain default slot preserves provide inject scope',
  }
}
</script>

<template>
  <view class="issue510-page">
    <view class="issue510-title">
      issue-510 augmented slot provide inject
    </view>

    <AugmentedSlotHost>
      <view class="issue510-wrapper">
        <AugmentedSlotLeaf />
      </view>
    </AugmentedSlotHost>
  </view>
</template>

<style scoped>
.issue510-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #f8fafc;
}

.issue510-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue510-wrapper {
  padding: 16rpx;
  background: #e0f2fe;
  border: 2rpx solid #0284c7;
  border-radius: 8rpx;
}
</style>
