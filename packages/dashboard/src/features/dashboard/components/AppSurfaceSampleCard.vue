<script setup lang="ts">
defineProps<{
  label: string
  tone: 'default' | 'strong' | 'muted'
}>()
</script>

<template>
  <div
    class="rounded-[18px] p-4"
    :class="{
      'border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)]': tone === 'default',
      'border border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-panel-strong)] shadow-[var(--dashboard-shadow)]': tone === 'strong',
      'border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)]': tone === 'muted',
    }"
  >
    {{ label }}
  </div>
</template>
