<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  accent?: boolean
}>()

const textClassName = computed(() =>
  props.accent
    ? 'text-[color:var(--dashboard-accent)]'
    : 'text-[color:var(--dashboard-text-soft)]',
)
</script>

<template>
  <p
    class="text-[11px] uppercase tracking-[0.18em]"
    :class="textClassName"
  >
    <slot />
  </p>
</template>
