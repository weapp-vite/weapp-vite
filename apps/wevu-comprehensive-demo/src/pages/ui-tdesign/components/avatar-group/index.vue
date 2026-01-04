<script setup lang="ts">
defineOptions({
  name: 'UiTDesignAvatarGroupPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-avatar-group',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-avatar-group
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-avatar-group />
    </view>
  </view>
</template>

