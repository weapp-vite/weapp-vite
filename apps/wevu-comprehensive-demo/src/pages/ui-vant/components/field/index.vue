<script setup lang="ts">
defineOptions({
  name: 'UiVantFieldPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-field',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-field
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-field />
      </view>
    </view>
  </van-config-provider>
</template>
