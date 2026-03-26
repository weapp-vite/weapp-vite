<script setup lang="ts">
import HighlightedCode from './HighlightedCode.vue'
import SectionCard from './SectionCard.vue'

defineProps<{
  code: string
  lang?: string
  subtitle?: string
  theme?: 'light' | 'dark'
  title: string
}>()
</script>

<template>
  <SectionCard :title="title" :subtitle="subtitle">
    <HighlightedCode :code="code" :lang="lang" :theme="theme" />
  </SectionCard>
</template>
