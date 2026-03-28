<script setup lang="ts">
import type { DashboardLabelValueItem } from '../types'
import { mutedPanelStyles } from '../utils/styles'
import AppMetaLabel from './AppMetaLabel.vue'

defineProps<{
  label: DashboardLabelValueItem['label']
  value: DashboardLabelValueItem['value']
}>()

const panelClassName = mutedPanelStyles({ padding: 'sm' })
</script>

<template>
  <div :class="panelClassName">
    <AppMetaLabel>
      {{ label }}
    </AppMetaLabel>
    <p class="mt-1 text-lg font-semibold">
      {{ value }}
    </p>
  </div>
</template>
