<script setup lang="ts">
defineProps<{
  root: {
    a: string
  }
}>()
</script>

<template>
  <view id="info-banner">
    {{ root.a }}
  </view>
</template>
