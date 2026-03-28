<script setup lang="ts">
import type { DashboardRuntimeSourceCardItem } from '../types'
import { getRuntimeSourceBadgeTone } from '../utils/format'
import { mutedPanelStyles } from '../utils/styles'
import AppRuntimeBadge from './AppRuntimeBadge.vue'

defineProps<{
  source: DashboardRuntimeSourceCardItem['source']
  count: DashboardRuntimeSourceCardItem['count']
  errorCount: DashboardRuntimeSourceCardItem['errorCount']
  averageDuration: DashboardRuntimeSourceCardItem['averageDuration']
  latestTimestamp?: DashboardRuntimeSourceCardItem['latestTimestamp']
  countLabel?: string
}>()
</script>

<template>
  <div :class="mutedPanelStyles({ padding: 'sm' })">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate font-medium text-[color:var(--dashboard-text)]">
          {{ source }}
        </p>
        <p class="mt-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--dashboard-text-soft)]">
          <template v-if="latestTimestamp">
            最近事件 {{ latestTimestamp }}
          </template>
          <template v-else>
            {{ count }} {{ countLabel ?? '条事件' }}
          </template>
        </p>
      </div>
      <AppRuntimeBadge
        :label="latestTimestamp ? `${count} 条` : `错误 ${errorCount}`"
        :tone="getRuntimeSourceBadgeTone(errorCount)"
      />
    </div>
    <div
      v-if="latestTimestamp"
      class="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-[color:var(--dashboard-text-soft)]"
    >
      <span class="rounded-full border border-[color:var(--dashboard-border)] px-2 py-0.5">
        错误 {{ errorCount }}
      </span>
      <span class="rounded-full border border-[color:var(--dashboard-border)] px-2 py-0.5">
        平均耗时 {{ averageDuration }}
      </span>
    </div>
    <p v-else class="mt-3 text-sm text-[color:var(--dashboard-text-muted)]">
      平均耗时 {{ averageDuration }}
    </p>
  </div>
</template>
