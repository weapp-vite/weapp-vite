<script setup lang="ts">
defineProps<{ value?: number }>()
</script>

<template>
  <view id="issue-852-count">Count: {{ value }}</view>
</template>
