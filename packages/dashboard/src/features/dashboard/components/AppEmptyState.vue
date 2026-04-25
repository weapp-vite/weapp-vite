<script setup lang="ts">
defineProps<{
  as?: 'div' | 'li' | 'p'
  compact?: boolean
}>()
</script>

<template>
  <component
    :is="as ?? 'div'"
    class="rounded-xl border border-dashed border-(--dashboard-border) bg-(--dashboard-panel-muted) text-sm text-(--dashboard-text-soft)"
    :class="compact ? 'px-3 py-4' : 'p-5'"
  >
    <slot />
  </component>
</template>
