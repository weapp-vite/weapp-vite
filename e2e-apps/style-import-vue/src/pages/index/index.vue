<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'Style Import',
})
</script>

<template>
  <view class="page">
    <view class="hello-import">
      hello
    </view>
    <view class="scss-imported">
      scss
    </view>
    <view class="external-src">
      src
    </view>
  </view>
</template>

<style lang="css">
@import './hello.css';

.css-inline {
  font-size: 28rpx;
}
</style>

<style lang="scss">
@import './scss-import.css';

.scss-inline {
  font-size: 30rpx;
}
</style>

<style src="./external.css"></style>
