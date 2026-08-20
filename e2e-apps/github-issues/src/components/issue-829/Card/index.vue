<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <view class="card">
    <view class="title">{{ title }}</view>
    <slot />
  </view>
</template>

<style scoped>
.card {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.title {
  margin-bottom: 10px;
  font-size: 20px;
  font-weight: bold;
}
</style>
