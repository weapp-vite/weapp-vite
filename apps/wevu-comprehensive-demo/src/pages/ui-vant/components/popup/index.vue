<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantPopupPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-popup',
}))

const show = ref(false)
function open() { show.value = true }
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-popup
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-button size="small" @click="open">打开</van-button>
      <van-popup :show="show" position="bottom" @close="show = false">
        <view style="padding: 32rpx; background: #fff">popup content</view>
      </van-popup>
    </view>
  </view>
</van-config-provider>
</template>

