<script setup lang="ts">
import type { ThemePreference } from '../composables/useThemeMode'
import type { ThemeOption } from '../types'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  inputId: string
  themeOptions: ThemeOption[]
  themePreference: ThemePreference
}>()

const emit = defineEmits<{
  select: [value: ThemePreference]
}>()
</script>

<template>
  <label
    class="inline-flex items-center gap-2 rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-3 py-2 text-xs font-medium text-[color:var(--dashboard-text-soft)]"
    :for="inputId"
  >
    <span class="h-4 w-4 text-[color:var(--dashboard-accent)]">
      <DashboardIcon :name="themeOptions.find(option => option.value === themePreference)?.iconName ?? 'theme-system'" />
    </span>
    <select
      :id="inputId"
      class="min-w-[8rem] bg-transparent text-[color:var(--dashboard-text)] outline-none"
      :value="themePreference"
      @change="emit('select', ($event.target as HTMLSelectElement).value as ThemePreference)"
    >
      <option
        v-for="option in themeOptions"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
