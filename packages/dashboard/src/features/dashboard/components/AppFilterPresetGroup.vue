<script setup lang="ts">
import { pillButtonStyles } from '../utils/styles'
import AppMetaLabel from './AppMetaLabel.vue'

defineProps<{
  title: string
  description: string
  presets: Array<{ key: string, label: string }>
}>()

const emit = defineEmits<{
  apply: [key: string]
}>()
</script>

<template>
  <div>
    <AppMetaLabel>
      {{ title }}
    </AppMetaLabel>
    <div class="mt-2 flex flex-wrap gap-2">
      <button
        v-for="preset in presets"
        :key="preset.key"
        :class="pillButtonStyles({ kind: 'theme', active: false })"
        @click="emit('apply', preset.key)"
      >
        {{ preset.label }}
      </button>
    </div>
    <p class="mt-2 text-xs leading-5 text-[color:var(--dashboard-text-soft)]">
      {{ description }}
    </p>
  </div>
</template>
