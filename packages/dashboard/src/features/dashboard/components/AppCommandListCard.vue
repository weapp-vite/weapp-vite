<script setup lang="ts">
defineProps<{
  eyebrow: string
  commands: string[]
}>()
</script>

<template>
  <div class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4">
    <p class="text-[11px] uppercase tracking-[0.24em] text-[color:var(--dashboard-text-soft)]">
      {{ eyebrow }}
    </p>
    <div class="mt-4 grid gap-2">
      <code
        v-for="command in commands"
        :key="command"
        class="rounded-xl bg-slate-950 px-3 py-3 text-xs text-slate-100 dark:bg-slate-900"
      >
        {{ command }}
      </code>
    </div>
  </div>
</template>
