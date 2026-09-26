import type { ShallowRef } from 'vue'
import type { DashboardLabelValueItem, DashboardRuntimeEvent, DashboardRuntimeSourceSummary } from '../types'
import { computed, onBeforeUnmount, watch } from 'vue'
import { dashboardRuntimeEvents } from '../utils/dashboardDevframe'
import { normalizeRuntimeEvents, summarizeRuntimeEventsBySource } from '../utils/runtimeEvents'
import { createRuntimeEventSummary } from '../utils/workspaceSummaries'

export function createInitialDashboardRuntimeEvents() {
  return normalizeRuntimeEvents(dashboardRuntimeEvents.value)
}

export function useDashboardRuntimeEventStream(
  runtimeEvents: ShallowRef<DashboardRuntimeEvent[]>,
) {
  const latestRuntimeEvent = computed(() => runtimeEvents.value[0] ?? null)

  const eventSummary = computed<DashboardLabelValueItem[]>(() => createRuntimeEventSummary(runtimeEvents.value))

  const runtimeSourceSummary = computed<DashboardRuntimeSourceSummary[]>(() =>
    summarizeRuntimeEventsBySource(runtimeEvents.value),
  )

  const syncRuntimeEvents = (payload: DashboardRuntimeEvent[]) => {
    const normalizedPayload = normalizeRuntimeEvents(payload)
    if (normalizedPayload.length > 0) {
      runtimeEvents.value = normalizedPayload.slice(0, 24)
    }
  }

  const stopRuntimeEventSync = watch(dashboardRuntimeEvents, syncRuntimeEvents, { immediate: true })
  onBeforeUnmount(stopRuntimeEventSync)

  return {
    eventSummary,
    latestRuntimeEvent,
    runtimeSourceSummary,
  }
}
