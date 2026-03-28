<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  as?: 'div' | 'li' | 'p'
  compact?: boolean
}>()

const spacingClassName = computed(() => props.compact ? 'px-3 py-4' : 'p-5')
</script>

<template>
  <component
    :is="as ?? 'div'"
    class="rounded-xl border border-dashed border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] text-sm text-[color:var(--dashboard-text-soft)]"
    :class="spacingClassName"
  >
    <slot />
  </component>
</template>
