<script setup lang="ts">
const props = defineProps({
  title: null,
  count: null,
  double: null,
})
</script>

<template>
  <view class="card">
    <view id="main-vue-card-title">
      {{ props.title }}
    </view>
    <view id="main-vue-card-count">
      count: {{ props.count }}
    </view>
    <view id="main-vue-card-double">
      double: {{ props.double }}
    </view>
  </view>
</template>

<style>
.card {
  padding: 16rpx;
  border: 1px solid #d0d7de;
}
</style>
