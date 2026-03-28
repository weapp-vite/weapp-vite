<script setup lang="ts">
defineProps<{
  accent?: boolean
}>()
</script>

<template>
  <p
    class="text-[11px] uppercase tracking-[0.18em]"
    :class="accent ? 'text-[color:var(--dashboard-accent)]' : 'text-[color:var(--dashboard-text-soft)]'"
  >
    <slot />
  </p>
</template>
