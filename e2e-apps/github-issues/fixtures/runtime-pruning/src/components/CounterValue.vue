<script setup lang="ts">
defineProps<{ value: number }>()
</script>

<template>
  <text id="pruning-child-value">{{ value }}</text>
</template>
