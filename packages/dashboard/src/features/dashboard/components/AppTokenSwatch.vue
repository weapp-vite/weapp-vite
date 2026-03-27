<script setup lang="ts">
defineProps<{
  name: string
  sample: string
}>()
</script>

<template>
  <li class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4">
    <div class="flex items-center justify-between gap-3">
      <code class="text-xs text-[color:var(--dashboard-text-soft)]">{{ name }}</code>
      <span
        class="h-8 w-14 rounded-xl border border-[color:var(--dashboard-border)]"
        :style="{ background: sample }"
      />
    </div>
  </li>
</template>
