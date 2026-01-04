<script setup lang="ts">
defineOptions({
  name: 'UiVantDatetimePickerPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-datetime-picker',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-datetime-picker
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-datetime-picker />
    </view>
  </view>
</van-config-provider>
</template>

