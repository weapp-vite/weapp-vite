<script setup lang="ts">
withDefaults(defineProps<{ text: string }>(), { text: "" });
</script>

<template>
  <text>{{ text }}</text>
</template>
