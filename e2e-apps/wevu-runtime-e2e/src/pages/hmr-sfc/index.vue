<script lang="ts">
/* HMR-SFC-SCRIPT */
import { defineComponent } from 'wevu'

export default defineComponent({
  data: () => ({
    marker: 'HMR-SFC-SCRIPT',
  }),
})
</script>

<template>
  <view class="hmr-sfc-page">
    <view class="title">HMR-SFC</view>
    <view class="marker">{{ marker }}</view>
  </view>
</template>

<style>
/* HMR-SFC-STYLE */
.hmr-sfc-page {
  padding: 24rpx;
}

.title {
  font-weight: 600;
  margin-bottom: 16rpx;
}

.marker {
  font-size: 28rpx;
}
</style>

<json>
{
  "component": false
}
</json>
