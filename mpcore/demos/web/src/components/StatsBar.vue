<script setup lang="ts">
defineProps<{
  items: Array<{
    label: string
    value: string | number
  }>
}>()
</script>

<template>
  <div class="sim-stats">
    <article v-for="item in items" :key="item.label" class="sim-stat">
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
    </article>
  </div>
</template>
