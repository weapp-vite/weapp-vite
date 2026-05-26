<script setup lang="ts">
defineOptions({
  name: 'Issue613Card',
})
</script>

<template>
  <view class="issue613-card">
    <view class="issue613-card__header" data-issue613-host="vue-card-header">
      <slot name="header" />
    </view>
    <view class="issue613-card__footer" data-issue613-host="vue-card-footer">
      <slot name="footer" />
    </view>
  </view>
</template>

<style scoped>
.issue613-card {
  min-height: 64rpx;
  padding: 24rpx;
  border: 1px solid #d7dde8;
}
</style>
