<script setup lang="ts">
const ready = ref(true)
const route = useRoute()
</script>

<template>
  <view id="auto-import-presets-next"><text>{{ ready }}:{{ route.path }}</text></view>
</template>
