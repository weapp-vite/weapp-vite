<template>
  <view class="root">{{ label }}</view>
</template>

<script>
export default {
  name: 'SfcBoth',
}
</script>

<script setup>
const label = 'script+setup'
</script>

<style>
.root {
  padding: 8rpx;
}
</style>
