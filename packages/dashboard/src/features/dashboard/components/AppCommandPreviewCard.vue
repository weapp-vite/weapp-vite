<script setup lang="ts">
defineProps<{
  label: string
  note: string
  command: string
}>()
</script>

<template>
  <article class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4">
    <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 class="font-medium">
          {{ label }}
        </h3>
        <p class="mt-1 text-sm text-[color:var(--dashboard-text-muted)]">
          {{ note }}
        </p>
      </div>
      <code class="rounded-xl bg-slate-950 px-3 py-2 text-xs text-slate-100 dark:bg-slate-900">
        {{ command }}
      </code>
    </div>
  </article>
</template>
