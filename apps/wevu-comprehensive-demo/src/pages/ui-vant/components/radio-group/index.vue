<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantRadioGroupPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-radio-group',
}))

const value = ref('1')
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-radio-group
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-radio-group :value="value">
        <van-radio name="1">选项 1</van-radio>
        <van-radio name="2">选项 2</van-radio>
      </van-radio-group>
    </view>
  </view>
</van-config-provider>
</template>

