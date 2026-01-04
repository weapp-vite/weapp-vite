<script setup lang="ts">
defineOptions({
  name: 'UiVantGridPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-grid',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-grid
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-grid column-num="3">
          <van-grid-item icon="photo-o" text="Grid 1" />
          <van-grid-item icon="photo-o" text="Grid 2" />
          <van-grid-item icon="photo-o" text="Grid 3" />
        </van-grid>
      </view>
    </view>
  </van-config-provider>
</template>
