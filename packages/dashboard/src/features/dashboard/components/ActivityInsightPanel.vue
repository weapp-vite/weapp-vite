<script setup lang="ts">
import type {
  DashboardLabelValueItem,
  DashboardRuntimeEvent,
  DashboardRuntimeSourceCardItem,
  WorkspaceDiagnosticItem,
} from '../types'
import type { RuntimeIncidentDigest } from '../utils/runtimeIncidentDigest'
import ActivitySelectedEventPanel from './ActivitySelectedEventPanel.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import AppRuntimeSourceCard from './AppRuntimeSourceCard.vue'
import AppStatCard from './AppStatCard.vue'
import AppSurfaceCard from './AppSurfaceCard.vue'
import RuntimeIncidentDigestPanel from './RuntimeIncidentDigestPanel.vue'

defineProps<{
  selectedEvent: DashboardRuntimeEvent | null
  incidentDigest: RuntimeIncidentDigest
  eventSummary: DashboardLabelValueItem[]
  filteredEventSummary: DashboardLabelValueItem[]
  diagnostics: WorkspaceDiagnosticItem[]
  sourceBreakdown: DashboardRuntimeSourceCardItem[]
}>()
</script>

<template>
  <div class="grid min-h-0 content-start gap-3 overflow-y-auto pr-1">
    <ActivitySelectedEventPanel :event="selectedEvent" />

    <RuntimeIncidentDigestPanel :digest="incidentDigest" />

    <AppSurfaceCard
      eyebrow="Runtime"
      title="事件摘要"
      icon-name="metric-time"
    >
      <div class="grid gap-2 sm:grid-cols-2">
        <AppStatCard
          v-for="item in [...eventSummary, ...filteredEventSummary]"
          :key="item.label"
          v-bind="item"
        />
      </div>
    </AppSurfaceCard>

    <AppSurfaceCard
      eyebrow="Diagnostics"
      title="当前诊断队列"
      icon-name="metric-health"
      content-class="min-h-0 overflow-hidden"
    >
      <ul class="grid max-h-44 gap-2 overflow-y-auto pr-1">
        <li
          v-for="item in diagnostics"
          :key="item.label"
          class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-4 py-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-medium">
                {{ item.label }}
              </p>
              <p class="mt-1 text-sm leading-6 text-(--dashboard-text-muted)">
                {{ item.detail }}
              </p>
            </div>
            <AppRuntimeBadge :label="item.status" tone="info" />
          </div>
        </li>
      </ul>
    </AppSurfaceCard>

    <AppSurfaceCard
      eyebrow="Sources"
      title="事件来源"
      icon-name="hero-system"
      content-class="min-h-0 overflow-hidden"
    >
      <div
        v-if="sourceBreakdown.length > 0"
        class="grid max-h-full gap-2 overflow-y-auto pr-1"
      >
        <AppRuntimeSourceCard
          v-for="source in sourceBreakdown"
          :key="source.source"
          v-bind="source"
        />
      </div>
    </AppSurfaceCard>
  </div>
</template>
