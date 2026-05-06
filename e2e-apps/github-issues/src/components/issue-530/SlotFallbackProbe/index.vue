<script setup lang="ts">
const scopedLabel = 'issue-530 scoped slot prop'
</script>

<template>
  <view class="issue530-probe">
    <slot :label="scopedLabel">
      <text class="issue530-fallback-default">issue-530 fallback default</text>
      <text class="issue530-scoped-fallback-default">issue-530 scoped fallback default</text>
    </slot>
  </view>
</template>

<style>
.issue530-probe {
  padding: 16rpx;
}
</style>
