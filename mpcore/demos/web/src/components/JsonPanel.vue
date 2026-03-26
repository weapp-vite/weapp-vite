<script setup lang="ts">
import SectionCard from './SectionCard.vue'

defineProps<{
  code: string
  subtitle?: string
  title: string
}>()
</script>

<template>
  <SectionCard :title="title" :subtitle="subtitle">
    <pre class="sim-code">{{ code }}</pre>
  </SectionCard>
</template>
