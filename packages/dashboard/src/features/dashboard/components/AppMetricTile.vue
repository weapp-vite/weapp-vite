<script setup lang="ts">
import AppMetaLabel from './AppMetaLabel.vue'

defineProps<{
  label: string
  value: string | number
}>()
</script>

<template>
  <div class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3">
    <AppMetaLabel>
      {{ label }}
    </AppMetaLabel>
    <p class="mt-1.5 text-base font-semibold text-[color:var(--dashboard-text)]">
      {{ value }}
    </p>
  </div>
</template>
