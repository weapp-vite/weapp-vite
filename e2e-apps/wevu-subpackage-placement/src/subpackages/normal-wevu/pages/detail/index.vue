<script setup lang="ts">
import { onLoad } from 'wevu'
import { normalState } from '../../shared/normalState'

definePageJson({
  navigationBarTitleText: 'normal detail',
})

onLoad((query) => {
  normalState.from.value = typeof query?.from === 'string' ? query.from : 'direct'
})

function goIndependent() {
  wx.navigateTo({
    url: '/subpackages/independent-wevu/pages/detail/index?from=normal-detail',
  })
}

function runE2E() {
  return {
    count: normalState.count.value,
    double: normalState.double.value,
    from: normalState.from.value,
  }
}

defineExpose({
  goIndependent,
  runE2E,
})
</script>

<template>
  <view class="page">
    <view id="normal-detail-marker">
      __WSP_NORMAL_DETAIL__
    </view>
    <view id="normal-detail-count">
      count: {{ normalState.count }}
    </view>
    <view id="normal-detail-double">
      double: {{ normalState.double }}
    </view>
    <view id="normal-detail-from">
      from: {{ normalState.from }}
    </view>
    <view id="normal-detail-to-independent" class="action" @tap="goIndependent">
      to independent detail
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
