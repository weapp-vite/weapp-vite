<script setup lang="ts">
import type { EventKindFilter, EventLevelFilter } from '../features/dashboard/composables/useActivityEventConsole'
import ActivityEventSortBar from '../features/dashboard/components/ActivityEventSortBar.vue'
import ActivityInsightPanel from '../features/dashboard/components/ActivityInsightPanel.vue'
import AppEmptyState from '../features/dashboard/components/AppEmptyState.vue'
import AppEventFilterPanel from '../features/dashboard/components/AppEventFilterPanel.vue'
import AppRuntimeEventListItem from '../features/dashboard/components/AppRuntimeEventListItem.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import { useActivityEventConsole } from '../features/dashboard/composables/useActivityEventConsole'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'

const { diagnostics, eventSummary, runtimeEvents } = useDashboardWorkspace()
const {
  eventKindFilter,
  eventKindOptions,
  eventLevelFilter,
  eventLevelOptions,
  eventSortMode,
  eventSourceFilter,
  eventSourceOptions,
  filteredEventSummary,
  filteredRuntimeEvents,
  filterPresets,
  incidentDigest,
  presetDescription,
  searchQuery,
  selectedEvent,
  selectedEventId,
  sourceBreakdown,
} = useActivityEventConsole(runtimeEvents)
</script>

<template>
  <div class="grid min-h-[40rem] min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] xl:items-stretch">
    <AppSurfaceCard
      eyebrow="Event Feed"
      title="事件控制台"
      icon-name="hero-commands"
      content-class="min-h-[36rem] min-w-0"
    >
      <div class="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(14rem,1fr)] gap-3 overflow-visible xl:h-full xl:grid-rows-[auto_auto_minmax(6rem,1fr)] xl:overflow-hidden">
        <AppEventFilterPanel
          class="min-h-0 min-w-0"
          :search-query="searchQuery"
          :preset-description="presetDescription"
          :filter-presets="filterPresets"
          :event-kind-options="eventKindOptions"
          :event-level-options="eventLevelOptions"
          :event-source-options="eventSourceOptions"
          :event-kind-filter="eventKindFilter"
          :event-level-filter="eventLevelFilter"
          :event-source-filter="eventSourceFilter"
          @update:search-query="searchQuery = $event"
          @update:event-kind-filter="eventKindFilter = $event as EventKindFilter"
          @update:event-level-filter="eventLevelFilter = $event as EventLevelFilter"
          @update:event-source-filter="eventSourceFilter = $event"
          @apply-preset="filterPresets.find(preset => preset.key === $event)?.apply()"
        />

        <ActivityEventSortBar
          v-model="eventSortMode"
          :events="filteredRuntimeEvents"
          :filtered-count="filteredRuntimeEvents.length"
          :total-count="runtimeEvents.length"
        />

        <AppEmptyState
          v-if="filteredRuntimeEvents.length === 0"
          as="p"
        >
          当前过滤条件下没有匹配事件。
        </AppEmptyState>

        <ul class="grid min-h-0 gap-2 overflow-y-auto pr-1 text-sm leading-6 text-(--dashboard-text-muted)">
          <AppRuntimeEventListItem
            v-for="event in filteredRuntimeEvents"
            :key="event.id"
            :event="event"
            :selected="selectedEvent?.id === event.id"
            @click="selectedEventId = event.id"
          />
        </ul>
      </div>
    </AppSurfaceCard>

    <ActivityInsightPanel
      :selected-event="selectedEvent"
      :incident-digest="incidentDigest"
      :event-summary="eventSummary"
      :filtered-event-summary="filteredEventSummary"
      :diagnostics="diagnostics"
      :source-breakdown="sourceBreakdown"
    />
  </div>
</template>
