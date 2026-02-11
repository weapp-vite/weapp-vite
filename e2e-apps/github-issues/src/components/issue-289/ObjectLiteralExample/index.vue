<script setup lang="ts">
import InfoBanner from '../InfoBanner/index.vue'
</script>

<template>
  <view class="block">
    <InfoBanner :root="{ a: 'aaaa' }" />
  </view>
</template>

<style scoped>
.block {
  margin-top: 20rpx;
}
</style>
