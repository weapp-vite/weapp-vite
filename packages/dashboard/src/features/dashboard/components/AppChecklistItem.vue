<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <li class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3">
    {{ text }}
  </li>
</template>
