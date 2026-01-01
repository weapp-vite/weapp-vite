<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
}>(), {
  title: 'Hello WeVU',
  subtitle: '',
})
</script>

<template>
  <view class="header">
    <text class="title">
      {{ props.title }}
    </text>
    <text v-if="props.subtitle" class="subtitle">
      {{ props.subtitle }}
    </text>
  </view>
</template>

<style>
.header {
  padding: 24rpx;
  background: linear-gradient(135deg, #4c6ef5, #7048e8);
  border-radius: 24rpx;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: rgb(255 255 255 / 85%);
}
</style>
