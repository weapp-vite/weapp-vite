<script setup lang="ts">
import { getRuntimeSourceBadgeTone } from '../utils/format'
import AppRuntimeBadge from './AppRuntimeBadge.vue'

defineProps<{
  source: string
  count: number
  errorCount: number
  averageDuration: string
  latestTimestamp?: string
  countLabel?: string
}>()
</script>

<template>
  <div class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3">
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
