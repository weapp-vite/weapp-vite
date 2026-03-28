<script setup lang="ts">
import type { DashboardIconName, DashboardTitleBlock } from '../types'
import { computed } from 'vue'
import { iconFrameStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  iconName: DashboardIconName
  title: DashboardTitleBlock['title']
  description?: DashboardTitleBlock['description']
}>()

const iconClassName = iconFrameStyles()
const hasDescription = computed(() => Boolean(props.description))
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <span :class="iconClassName">
        <span class="h-5 w-5">
          <DashboardIcon :name="iconName" />
        </span>
      </span>
      <div>
        <h2 class="text-lg font-semibold text-[color:var(--dashboard-text)]">
          {{ title }}
        </h2>
        <p
          v-if="hasDescription"
          class="text-xs text-[color:var(--dashboard-text-soft)] md:text-sm"
        >
          {{ description }}
        </p>
      </div>
    </div>
    <slot name="meta" />
  </div>
</template>
