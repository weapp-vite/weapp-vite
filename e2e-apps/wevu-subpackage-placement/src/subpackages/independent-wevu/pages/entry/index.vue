<script setup lang="ts">
import { independentState } from '../../shared/independentState'

definePageJson({
  navigationBarTitleText: 'independent entry',
})

function increase() {
  independentState.count.value += 1
}

function goDetail() {
  wx.navigateTo({
    url: '/subpackages/independent-wevu/pages/detail/index?from=entry',
  })
}

function goNormal() {
  wx.navigateTo({
    url: '/subpackages/normal-wevu/pages/entry/index?from=independent-entry',
  })
}

function runE2E() {
  increase()
  return {
    count: independentState.count.value,
    double: independentState.double.value,
  }
}

defineExpose({
  increase,
  goDetail,
  goNormal,
  runE2E,
})
</script>

<template>
  <view class="page">
    <view id="independent-marker">
      __WSP_INDEPENDENT_ENTRY__
    </view>
    <view id="independent-kind">
      package: independent
    </view>
    <view id="independent-count">
      count: {{ independentState.count }}
    </view>
    <view id="independent-double">
      double: {{ independentState.double }}
    </view>
    <view id="independent-inc" class="action" @tap="increase">
      increase independent
    </view>
    <view id="independent-to-detail" class="action" @tap="goDetail">
      to independent detail
    </view>
    <view id="independent-to-normal" class="action" @tap="goNormal">
      to normal entry
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
