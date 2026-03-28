<script setup lang="ts">
import { pillButtonStyles } from '../utils/styles'
import AppMetaLabel from './AppMetaLabel.vue'

defineProps<{
  title: string
  options: Array<{ value: string, label: string }>
  selectedValue: string
}>()

const emit = defineEmits<{
  select: [value: string]
}>()
</script>

<template>
  <div>
    <AppMetaLabel>
      {{ title }}
    </AppMetaLabel>
    <div class="mt-2 flex flex-wrap gap-2">
      <button
        v-for="option in options"
        :key="option.value"
        :class="pillButtonStyles({ kind: 'theme', active: selectedValue === option.value })"
        @click="emit('select', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
