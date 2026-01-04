<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantCheckboxPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-checkbox',
}))

const value = ref(['a'])
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-checkbox
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-checkbox-group :value="value">
        <van-checkbox name="a">A</van-checkbox>
        <van-checkbox name="b">B</van-checkbox>
      </van-checkbox-group>
    </view>
  </view>
</van-config-provider>
</template>

