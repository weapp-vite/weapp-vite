<script setup lang="ts">
defineOptions({
  externalClasses: ['custom-class'],
})

const props = withDefaults(defineProps<{
  title: string
  subtitle: string
  rootStyle?: string
}>(), {
  rootStyle: '',
})

defineComponentJson({
  styleIsolation: 'apply-shared',
})
</script>

<template>
  <view class="demo-card custom-class" :style="props.rootStyle">
    <text class="demo-title">
      {{ title }}
    </text>
    <text class="demo-subtitle">
      {{ subtitle }}
    </text>
  </view>
</template>

<style>
.demo-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 20rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 12rpx 28rpx rgb(17 24 39 / 8%);
}

.demo-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
}

.demo-subtitle {
  display: block;
  font-size: 22rpx;
  line-height: 1.6;
  opacity: 0.82;
}
</style>
