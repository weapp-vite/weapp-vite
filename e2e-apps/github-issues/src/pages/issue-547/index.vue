<script setup lang="ts">
import NestedSlotCell from '../../components/issue-547/NestedSlotCell/index.vue'
import NestedSlotGroup from '../../components/issue-547/NestedSlotGroup/index.vue'
import NestedSlotImage from '../../components/issue-547/NestedSlotImage/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-547',
})

function _runE2E() {
  return {
    ok: true,
    expected: 'issue-547 nested slot image',
  }
}
</script>

<template>
  <view
    id="issue547-page"
    class="issue547-page"
    data-e2e-issue="547"
  >
    <view class="issue547-title">
      issue-547 nested augmented slot
    </view>

    <NestedSlotGroup>
      <NestedSlotCell>
        <NestedSlotImage />
      </NestedSlotCell>
    </NestedSlotGroup>
  </view>
</template>

<style scoped>
.issue547-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #fff;
}

.issue547-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}
</style>
