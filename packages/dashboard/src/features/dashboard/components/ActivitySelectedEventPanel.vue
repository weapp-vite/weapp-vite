<script setup lang="ts">
import type { DashboardRuntimeEvent } from '../types'
import { computed } from 'vue'
import { formatDuration } from '../utils/format'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import AppRuntimeFocusCard from './AppRuntimeFocusCard.vue'
import AppSurfaceCard from './AppSurfaceCard.vue'

const props = defineProps<{
  event: DashboardRuntimeEvent | null
}>()

const durationText = computed(() => props.event?.durationMs !== undefined
  ? `耗时 ${formatDuration(props.event.durationMs)}`
  : undefined)

const profileMetrics = computed(() => {
  const profile = props.event?.profile
  if (!profile) {
    return []
  }
  return [
    { label: '总耗时', value: formatDuration(profile.totalMs) },
    { label: '构建核心', value: formatDuration(profile.buildCoreMs) },
    { label: '转换', value: formatDuration(profile.transformMs) },
    { label: '写入', value: formatDuration(profile.writeMs) },
    { label: '监听到脏标记', value: formatDuration(profile.watchToDirtyMs) },
    { label: '产物发射', value: formatDuration(profile.emitMs) },
    { label: '共享 chunk', value: formatDuration(profile.sharedChunkResolveMs) },
  ].filter(item => item.value !== '未记录')
})

const profileCounts = computed(() => {
  const profile = props.event?.profile
  if (!profile) {
    return []
  }
  return [
    { label: '脏入口', value: profile.dirtyCount },
    { label: '待处理', value: profile.pendingCount },
    { label: '已发射', value: profile.emittedCount },
  ].filter((item): item is { label: string, value: number } => typeof item.value === 'number')
})

const profileFile = computed(() =>
  props.event?.profile?.sourceRootFile
  ?? props.event?.profile?.relativeFile
  ?? props.event?.profile?.file,
)
</script>

<template>
  <AppSurfaceCard
    eyebrow="Selected"
    title="当前事件"
    icon-name="metric-search"
  >
    <AppRuntimeFocusCard
      :event="event"
      eyebrow="focus"
      empty-title="未选择事件"
      empty-detail="选择左侧事件后查看详情。"
      :duration-text="durationText"
    >
      <div v-if="event?.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
        <AppRuntimeBadge
          v-for="tag in event.tags"
          :key="tag"
          :label="tag"
          tone="neutral"
        />
      </div>

      <div v-if="event?.profile" class="mt-4 grid gap-3 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3">
        <div class="flex min-w-0 items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-(--dashboard-text)">
              HMR 阶段明细
            </p>
            <p v-if="profileFile" class="mt-1 truncate font-mono text-xs text-(--dashboard-text-soft)">
              {{ profileFile }}
            </p>
          </div>
          <AppRuntimeBadge
            v-if="event.profile.event"
            :label="event.profile.event"
            tone="info"
          />
        </div>

        <dl v-if="profileMetrics.length > 0" class="grid gap-2 sm:grid-cols-2">
          <div
            v-for="item in profileMetrics"
            :key="item.label"
            class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2"
          >
            <dt class="text-[11px] text-(--dashboard-text-soft)">
              {{ item.label }}
            </dt>
            <dd class="mt-1 text-sm font-semibold text-(--dashboard-text)">
              {{ item.value }}
            </dd>
          </div>
        </dl>

        <div v-if="profileCounts.length > 0" class="flex flex-wrap gap-1.5">
          <AppRuntimeBadge
            v-for="item in profileCounts"
            :key="item.label"
            :label="`${item.label} ${item.value}`"
            tone="neutral"
          />
        </div>

        <div v-if="event.profile.dirtyReasonSummary?.length || event.profile.pendingReasonSummary?.length" class="grid gap-2 text-xs leading-5 text-(--dashboard-text-muted)">
          <p v-if="event.profile.dirtyReasonSummary?.length">
            脏标记：{{ event.profile.dirtyReasonSummary.join('、') }}
          </p>
          <p v-if="event.profile.pendingReasonSummary?.length">
            待处理：{{ event.profile.pendingReasonSummary.join('、') }}
          </p>
        </div>
      </div>
    </AppRuntimeFocusCard>
  </AppSurfaceCard>
</template>
