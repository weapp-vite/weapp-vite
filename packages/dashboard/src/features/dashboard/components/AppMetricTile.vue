<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
}>()
</script>

<template>
  <div class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3">
    <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
      {{ label }}
    </p>
    <p class="mt-1.5 text-base font-semibold text-[color:var(--dashboard-text)]">
      {{ value }}
    </p>
  </div>
</template>
