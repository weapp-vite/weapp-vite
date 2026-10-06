<script setup lang="ts">
defineProps<{ open: boolean }>()
defineComponentJson({ component: true })
</script>

<template>
  <view v-if="open">
    <slot />
  </view>
</template>
