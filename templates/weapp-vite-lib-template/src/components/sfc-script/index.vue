<script>
export default {
  name: 'LibSfcScript',
  data() {
    return {
      text: 'Script-only Vue SFC component',
    }
  },
}
</script>

<template>
  <view class="card">
    <view class="title">
      SFC (script)
    </view>
    <view class="desc">
      {{ text }}
    </view>
  </view>
</template>

<style>
.card {
  padding: 20rpx;
  background: #fff7ed;
  border: 2rpx solid #fdba74;
  border-radius: 16rpx;
}

.title {
  font-size: 28rpx;
  font-weight: 600;
  color: #c2410c;
}

.desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #9a3412;
}
</style>
