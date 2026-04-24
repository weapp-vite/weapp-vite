<script setup lang="ts">
import type { DashboardTokenSwatchItem } from '../types'
import { computed } from 'vue'
import { mutedPanelStyles } from '../utils/styles'

const props = defineProps<{
  name: DashboardTokenSwatchItem['name']
  sample: DashboardTokenSwatchItem['sample']
}>()

const sampleStyle = computed(() => ({
  background: props.sample,
}))
</script>

<template>
  <li :class="mutedPanelStyles()">
    <div class="flex items-center justify-between gap-3">
      <code class="text-xs text-(--dashboard-text-soft)">{{ name }}</code>
      <span
        class="h-8 w-14 rounded-xl border border-(--dashboard-border)"
        :style="sampleStyle"
      />
    </div>
  </li>
</template>
