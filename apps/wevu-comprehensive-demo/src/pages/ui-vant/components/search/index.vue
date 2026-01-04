<script setup lang="ts">
defineOptions({
  name: 'UiVantSearchPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-search',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-search
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-search />
    </view>
  </view>
</van-config-provider>
</template>

