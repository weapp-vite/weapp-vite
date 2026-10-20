<script setup lang="ts">
function open(count: number) { return count }
function hidden() { return 'private' }
defineExpose({ open })
void hidden
</script>

<template>
  <view />
</template>
