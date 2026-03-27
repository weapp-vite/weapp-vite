<script setup lang="ts">
defineProps<{
  eyebrow?: string
}>()
</script>

<template>
  <div class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4">
    <p
      v-if="eyebrow"
      class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]"
    >
      {{ eyebrow }}
    </p>
    <div :class="eyebrow ? 'mt-3' : undefined">
      <slot />
    </div>
  </div>
</template>
