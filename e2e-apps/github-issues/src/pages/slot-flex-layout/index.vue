<script setup lang="ts">
import SlotFlexHost from '../../components/slot-flex-host/index.vue'

definePageJson({
  navigationBarTitleText: 'slot-flex-layout',
})
</script>

<template>
  <view class="slot-flex-layout-page">
    <view class="slot-flex-layout-title">
      slot flex layout experiment
    </view>

    <view class="slot-flex-layout-case">
      <view class="slot-flex-layout-case__label">
        single-per-slot
      </view>
      <SlotFlexHost>
        <template #left>
          <view class="slot-flex-item slot-flex-item--single-left" data-case="single-left">
            L1
          </view>
        </template>
        <template #middle>
          <view class="slot-flex-item slot-flex-item--single-middle" data-case="single-middle">
            M1
          </view>
        </template>
        <template #right>
          <view class="slot-flex-item slot-flex-item--single-right" data-case="single-right">
            R1
          </view>
        </template>
      </SlotFlexHost>
    </view>

    <view class="slot-flex-layout-case">
      <view class="slot-flex-layout-case__label">
        middle-multi
      </view>
      <SlotFlexHost>
        <template #left>
          <view class="slot-flex-item slot-flex-item--middle-multi-left" data-case="middle-multi-left">
            L1
          </view>
        </template>
        <template #middle>
          <view class="slot-flex-item slot-flex-item--middle-multi-center-a" data-case="middle-multi-center-a">
            M1
          </view>
          <view class="slot-flex-item slot-flex-item--middle-multi-center-b" data-case="middle-multi-center-b">
            M2
          </view>
        </template>
        <template #right>
          <view class="slot-flex-item slot-flex-item--middle-multi-right" data-case="middle-multi-right">
            R1
          </view>
        </template>
      </SlotFlexHost>
    </view>

    <view class="slot-flex-layout-case">
      <view class="slot-flex-layout-case__label">
        all-multi
      </view>
      <SlotFlexHost>
        <template #left>
          <view class="slot-flex-item slot-flex-item--all-multi-left-a" data-case="all-multi-left-a">
            L1
          </view>
          <view class="slot-flex-item slot-flex-item--all-multi-left-b" data-case="all-multi-left-b">
            L2
          </view>
        </template>
        <template #middle>
          <view class="slot-flex-item slot-flex-item--all-multi-middle-a" data-case="all-multi-middle-a">
            M1
          </view>
          <view class="slot-flex-item slot-flex-item--all-multi-middle-b" data-case="all-multi-middle-b">
            M2
          </view>
        </template>
        <template #right>
          <view class="slot-flex-item slot-flex-item--all-multi-right-a" data-case="all-multi-right-a">
            R1
          </view>
          <view class="slot-flex-item slot-flex-item--all-multi-right-b" data-case="all-multi-right-b">
            R2
          </view>
        </template>
      </SlotFlexHost>
    </view>
  </view>
</template>

<style scoped>
.slot-flex-layout-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.slot-flex-layout-title {
  margin-bottom: 20rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.slot-flex-layout-case + .slot-flex-layout-case {
  margin-top: 18rpx;
}

.slot-flex-layout-case__label {
  margin-bottom: 10rpx;
  font-size: 24rpx;
  color: #334155;
}

.slot-flex-item {
  box-sizing: border-box;
  width: 84rpx;
  min-height: 60rpx;
  padding: 10rpx 0;
  font-size: 20rpx;
  line-height: 20rpx;
  color: #0f172a;
  text-align: center;
  background: #cbd5e1;
  border-radius: 12rpx;
}

.slot-flex-item--single-left,
.slot-flex-item--middle-multi-left,
.slot-flex-item--all-multi-left-a,
.slot-flex-item--all-multi-left-b {
  background: #bfdbfe;
}

.slot-flex-item--single-middle,
.slot-flex-item--middle-multi-center-a,
.slot-flex-item--middle-multi-center-b,
.slot-flex-item--all-multi-middle-a,
.slot-flex-item--all-multi-middle-b {
  background: #bbf7d0;
}

.slot-flex-item--single-right,
.slot-flex-item--middle-multi-right,
.slot-flex-item--all-multi-right-a,
.slot-flex-item--all-multi-right-b {
  background: #fde68a;
}
</style>
