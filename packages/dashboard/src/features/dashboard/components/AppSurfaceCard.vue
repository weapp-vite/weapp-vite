<script setup lang="ts">
import type {
  DashboardIconName,
  DashboardSurfacePadding,
  DashboardSurfaceTone,
  DashboardTitleBlock,
} from '../types'
import { computed, useSlots } from 'vue'
import { cn } from '../../../lib/cn'
import { iconFrameStyles, surfaceStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

const props = withDefaults(defineProps<{
  title?: DashboardTitleBlock['title']
  description?: DashboardTitleBlock['description']
  eyebrow?: string
  iconName?: DashboardIconName
  tone?: DashboardSurfaceTone
  padding?: DashboardSurfacePadding
  contentClass?: string
}>(), {
  title: undefined,
  description: undefined,
  eyebrow: undefined,
  iconName: undefined,
  tone: 'default',
  padding: 'md',
  contentClass: '',
})

const slots = useSlots()

const hasHeader = computed(() => Boolean(props.title || props.description || slots.header))
const bodyClassName = computed(() => hasHeader.value ? 'mt-4' : '')
</script>

<template>
  <section :class="cn(surfaceStyles({ tone, padding }), contentClass)">
    <header v-if="hasHeader" class="flex items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span v-if="iconName" :class="iconFrameStyles({ size: 'md' })" class="shrink-0">
          <span class="h-5 w-5">
            <DashboardIcon :name="iconName" />
          </span>
        </span>
        <div>
          <p v-if="eyebrow" class="text-[11px] uppercase tracking-[0.24em] text-[color:var(--dashboard-accent)]">
            {{ eyebrow }}
          </p>
          <h2 v-if="title" class="text-lg font-semibold tracking-tight">
            {{ title }}
          </h2>
          <p v-if="description" class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
            {{ description }}
          </p>
        </div>
      </div>
      <slot name="header" />
    </header>
    <div :class="bodyClassName">
      <slot />
    </div>
  </section>
</template>
