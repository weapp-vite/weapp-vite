import type { ShallowRef } from 'vue'
import type { DashboardLabelValueItem, DashboardRuntimeEvent, DashboardRuntimeSourceSummary } from '../types'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { sampleRuntimeEvents } from '../constants/shell'
import { normalizeRuntimeEvents, summarizeRuntimeEventsBySource } from '../utils/runtimeEvents'
import { createRuntimeEventSummary } from '../utils/workspaceSummaries'

export function createInitialDashboardRuntimeEvents() {
  return window.__WEAPP_VITE_DASHBOARD_EVENTS__?.length
    ? normalizeRuntimeEvents(window.__WEAPP_VITE_DASHBOARD_EVENTS__)
    : normalizeRuntimeEvents(sampleRuntimeEvents)
}

export function useDashboardRuntimeEventStream(
  runtimeEvents: ShallowRef<DashboardRuntimeEvent[]>,
) {
  const latestRuntimeEvent = computed(() => runtimeEvents.value[0] ?? null)

  const eventSummary = computed<DashboardLabelValueItem[]>(() => createRuntimeEventSummary(runtimeEvents.value))

  const runtimeSourceSummary = computed<DashboardRuntimeSourceSummary[]>(() =>
    summarizeRuntimeEventsBySource(runtimeEvents.value),
  )

  const pushRuntimeEvents = (payload: DashboardRuntimeEvent[] | null | undefined) => {
    const normalizedPayload = normalizeRuntimeEvents(payload)

    if (normalizedPayload.length === 0) {
      return
    }

    const nextEvents = [...normalizedPayload, ...runtimeEvents.value]
    const deduped = new Map<string, DashboardRuntimeEvent>()

    for (const event of nextEvents) {
      deduped.set(event.id, event)
    }

    runtimeEvents.value = [...deduped.values()].slice(0, 24)
    window.__WEAPP_VITE_DASHBOARD_EVENTS__ = [...runtimeEvents.value]
  }

  const handleRuntimeEvent = (event: Event) => {
    const payload = event instanceof CustomEvent
      ? event.detail
      : null
    const events = Array.isArray(payload) ? payload : payload ? [payload] : null

    pushRuntimeEvents(events)
  }

  onMounted(() => {
    window.addEventListener('weapp-dashboard:event', handleRuntimeEvent)
    pushRuntimeEvents(window.__WEAPP_VITE_DASHBOARD_EVENTS__)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('weapp-dashboard:event', handleRuntimeEvent)
  })

  return {
    eventSummary,
    latestRuntimeEvent,
    runtimeSourceSummary,
  }
}
