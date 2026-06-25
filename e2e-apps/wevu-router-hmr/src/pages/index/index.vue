<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'router hmr',
})

const route = useRoute()
const title = 'ROUTER-HMR-BASE'
const routeLabel = computed(() => route.fullPath || `/${route.path}`)
</script>

<template>
  <view class="page">
    <view class="title">
      {{ title }}
    </view>
    <view class="route">
      {{ routeLabel }}
    </view>
  </view>
</template>

<style>
.page {
  padding: 24rpx;
}

.title {
  font-size: 30rpx;
  font-weight: 600;
}

.route {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #475569;
}
</style>
