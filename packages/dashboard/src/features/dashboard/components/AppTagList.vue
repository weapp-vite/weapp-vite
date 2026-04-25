<script setup lang="ts">
import type { DashboardKeyedLabelItem } from '../types'
import { computed } from 'vue'

const props = defineProps<{
  tags: string[]
}>()

const tagClassName = 'rounded-full border border-(--dashboard-border) px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-(--dashboard-text-soft)'

const tagItems = computed<DashboardKeyedLabelItem[]>(() => props.tags.map(tag => ({
  key: tag,
  label: tag,
})))
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <span
      v-for="tag in tagItems"
      :key="tag.key"
      :class="tagClassName"
    >
      {{ tag.label }}
    </span>
  </div>
</template>
