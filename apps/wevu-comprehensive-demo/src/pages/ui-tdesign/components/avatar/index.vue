<script setup lang="ts">
defineOptions({
  name: 'UiTDesignAvatarPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-avatar',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-avatar
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-avatar />
    </view>
  </view>
</template>

