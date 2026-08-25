<script setup lang="ts">
interface GalleryEntry {
  item: {
    count: number
    id: string
    title: string
  }
}

const props = defineProps<{
  entry: GalleryEntry
  modelValue: string
}>()

const emit = defineEmits<{
  'increment': []
  'update:modelValue': [value: string]
}>()

function handleTap() {
  emit('update:modelValue', `${props.modelValue}-updated`)
  emit('increment')
}
</script>

<template>
  <button
    class="issue868-gallery-card issue-868-card-button"
    :data-entry-id="entry.item.id"
    @tap="handleTap"
  >
    <text class="issue-868-card-title">{{ modelValue }}</text>
    <text class="issue-868-card-count">{{ entry.item.count }}</text>
  </button>
</template>

<style>
.issue868-gallery-card {
  display: block;
}
</style>
