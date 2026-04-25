<script setup lang="ts">
defineProps<{
  accent?: boolean
}>()
</script>

<template>
  <p
    class="text-[11px] uppercase tracking-[0.18em]"
    :class="accent ? 'text-(--dashboard-accent)' : 'text-(--dashboard-text-soft)'"
  >
    <slot />
  </p>
</template>
