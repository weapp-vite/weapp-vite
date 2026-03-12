<script setup lang="ts">
import { normalState } from '../../shared/normalState'

definePageJson({
  navigationBarTitleText: 'normal entry',
})

function increase() {
  normalState.count.value += 1
}

function goDetail() {
  wx.navigateTo({
    url: '/subpackages/normal-wevu/pages/detail/index?from=entry',
  })
}

function goIndependent() {
  wx.navigateTo({
    url: '/subpackages/independent-wevu/pages/entry/index?from=normal-entry',
  })
}

function runE2E() {
  increase()
  return {
    count: normalState.count.value,
    double: normalState.double.value,
  }
}

defineExpose({
  increase,
  goDetail,
  goIndependent,
  runE2E,
})
</script>

<template>
  <view class="page">
    <view id="normal-marker">
      __WSP_NORMAL_ENTRY__
    </view>
    <view id="normal-kind">
      package: normal
    </view>
    <view id="normal-count">
      count: {{ normalState.count }}
    </view>
    <view id="normal-double">
      double: {{ normalState.double }}
    </view>
    <view id="normal-inc" class="action" @tap="increase">
      increase normal
    </view>
    <view id="normal-to-detail" class="action" @tap="goDetail">
      to normal detail
    </view>
    <view id="normal-to-independent" class="action" @tap="goIndependent">
      to independent entry
    </view>
  </view>
</template>

<style>
.page {
  padding: 24rpx;
}

.action {
  margin-top: 16rpx;
}
</style>
