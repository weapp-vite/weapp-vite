<script setup lang="ts">
import debounce from 'debounce'

const marker = typeof debounce === 'function'
  ? 'debounce-probe-ready'
  : 'debounce-probe-missing'
</script>

<template>
  <text>{{ marker }}</text>
</template>
