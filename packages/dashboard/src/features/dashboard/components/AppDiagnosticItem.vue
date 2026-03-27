<script setup lang="ts">
import AppRuntimeBadge from './AppRuntimeBadge.vue'

defineProps<{
  label: string
  detail: string
  status: string
}>()
</script>

<template>
  <li class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-medium">
          {{ label }}
        </p>
        <p class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
          {{ detail }}
        </p>
      </div>
      <AppRuntimeBadge :label="status" tone="info" />
    </div>
  </li>
</template>
