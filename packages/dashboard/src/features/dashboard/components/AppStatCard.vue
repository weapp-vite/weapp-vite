<script setup lang="ts">
import AppMetaLabel from './AppMetaLabel.vue'

defineProps<{
  label: string
  value: string
}>()
</script>

<template>
  <div class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3">
    <AppMetaLabel>
      {{ label }}
    </AppMetaLabel>
    <p class="mt-1 text-lg font-semibold">
      {{ value }}
    </p>
  </div>
</template>
