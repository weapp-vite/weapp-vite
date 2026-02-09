<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    badge?: string
  }>(),
  {
    title: 'WeVU Starter',
    description: '',
    badge: 'Template',
  },
)
</script>

<template>
  <view class="banner">
    <view class="main">
      <text class="title">
        {{ props.title }}
      </text>
      <text v-if="props.description" class="description">
        {{ props.description }}
      </text>
    </view>
    <text class="badge">
      {{ props.badge }}
    </text>
  </view>
</template>

<style>
.banner {
  display: flex;
  gap: 20rpx;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 28rpx;
  margin: 16rpx 0 24rpx;
  background: linear-gradient(120deg, #4c6ef5, #5f3dc4);
  border-radius: 24rpx;
}

.main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 34rpx;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}

.description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 24rpx;
  color: rgb(255 255 255 / 86%);
  white-space: nowrap;
}

.badge {
  flex: none;
  padding: 8rpx 16rpx;
  font-size: 22rpx;
  color: #4c2fa6;
  background: #fff;
  border-radius: 999rpx;
}
</style>
