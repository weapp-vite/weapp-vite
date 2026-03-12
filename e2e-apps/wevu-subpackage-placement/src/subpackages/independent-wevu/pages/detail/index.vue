<script setup lang="ts">
import { onLoad } from 'wevu'
import { independentState } from '../../shared/independentState'

definePageJson({
  navigationBarTitleText: 'independent detail',
})

onLoad((query) => {
  independentState.from.value = typeof query?.from === 'string' ? query.from : 'direct'
})

function goNormal() {
  wx.navigateTo({
    url: '/subpackages/normal-wevu/pages/detail/index?from=independent-detail',
  })
}

function runE2E() {
  return {
    count: independentState.count.value,
    double: independentState.double.value,
    from: independentState.from.value,
  }
}

defineExpose({
  goNormal,
  runE2E,
})
</script>

<template>
  <view class="page">
    <view id="independent-detail-marker">
      __WSP_INDEPENDENT_DETAIL__
    </view>
    <view id="independent-detail-count">
      count: {{ independentState.count }}
    </view>
    <view id="independent-detail-double">
      double: {{ independentState.double }}
    </view>
    <view id="independent-detail-from">
      from: {{ independentState.from }}
    </view>
    <view id="independent-detail-to-normal" class="action" @tap="goNormal">
      to normal detail
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
