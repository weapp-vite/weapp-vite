<script setup lang="ts">
import type { DashboardTab, DashboardTabOption } from '../types'
import { pillButtonStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  tabs: DashboardTabOption[]
  activeTab: DashboardTab
}>()

const emit = defineEmits<{
  select: [value: DashboardTab]
}>()
</script>

<template>
  <nav class="flex flex-wrap gap-2">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :class="pillButtonStyles({ kind: 'nav', active: activeTab === tab.key })"
      @click="emit('select', tab.key)"
    >
      <span class="h-4.5 w-4.5">
        <DashboardIcon :name="tab.iconName" />
      </span>
      {{ tab.label }}
    </button>
  </nav>
</template>
