<script setup lang="ts">
import type { ThemePreference } from '../composables/useThemeMode'
import type { ThemeOption } from '../types'
import { pillButtonStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  options: ThemeOption[]
  selectedValue: ThemePreference
}>()

const emit = defineEmits<{
  select: [value: ThemePreference]
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-for="option in options"
      :key="option.value"
      :class="pillButtonStyles({ kind: 'theme', active: selectedValue === option.value })"
      @click="emit('select', option.value)"
    >
      <span class="h-4 w-4">
        <DashboardIcon :name="option.iconName" />
      </span>
      {{ option.label }}
    </button>
  </div>
</template>
