<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  to: string
  title: string
  description: string
}>()
</script>

<template>
  <RouterLink
    class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-4 transition hover:border-[color:var(--dashboard-border-strong)] hover:bg-[color:var(--dashboard-panel)]"
    :to="to"
  >
    <p class="font-medium">
      {{ title }}
    </p>
    <p class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
      {{ description }}
    </p>
  </RouterLink>
</template>
