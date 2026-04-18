<script setup lang="ts">
defineProps<{
  description: string
  title: string
}>()
</script>

<template>
  <view class="card">
    <view class="title">{{ title }}</view>
    <view class="description">{{ description }}</view>
  </view>
</template>
