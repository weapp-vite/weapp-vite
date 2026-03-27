<script setup lang="ts">
defineProps<{
  tags: string[]
}>()
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <span
      v-for="tag in tags"
      :key="tag"
      class="rounded-full border border-[color:var(--dashboard-border)] px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-[color:var(--dashboard-text-soft)]"
    >
      {{ tag }}
    </span>
  </div>
</template>
