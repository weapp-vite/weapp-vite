<script setup lang="ts">
import { computed } from 'vue'

interface TagItem {
  key: string
  label: string
}

const props = defineProps<{
  tags: string[]
}>()

const tagClassName = 'rounded-full border border-[color:var(--dashboard-border)] px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-[color:var(--dashboard-text-soft)]'

function createTagItem(tag: string): TagItem {
  return {
    key: tag,
    label: tag,
  }
}

const tagItems = computed(() => props.tags.map(tag => createTagItem(tag)))
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
