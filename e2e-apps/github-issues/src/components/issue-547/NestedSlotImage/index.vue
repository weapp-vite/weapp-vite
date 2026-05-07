<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue547-image" data-issue547-image="true">
    issue-547 nested slot image
  </view>
</template>

<style scoped>
.issue547-image {
  min-height: 64rpx;
  padding: 12rpx;
  font-size: 24rpx;
  line-height: 40rpx;
  color: #052e16;
  background: #dcfce7;
  border: 2rpx solid #16a34a;
  border-radius: 8rpx;
}
</style>
