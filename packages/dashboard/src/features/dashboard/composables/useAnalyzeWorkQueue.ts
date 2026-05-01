import type { AnalyzeWorkQueueItem } from '../types'
import { computed, onMounted, shallowRef } from 'vue'
import { normalizeWorkQueueItems } from '../utils/workQueue'

const workQueueStorageKey = 'weapp-vite:dashboard:analyze-work-queue'

function readStoredItems() {
  try {
    const raw = window.localStorage.getItem(workQueueStorageKey)
    return normalizeWorkQueueItems(raw ? JSON.parse(raw) : null)
  }
  catch {
    return []
  }
}

function writeStoredItems(items: AnalyzeWorkQueueItem[]) {
  try {
    window.localStorage.setItem(workQueueStorageKey, JSON.stringify(items))
  }
  catch { }
}

export function useAnalyzeWorkQueue() {
  const workQueueItems = shallowRef<AnalyzeWorkQueueItem[]>([])

  const openWorkQueueItems = computed(() => workQueueItems.value.filter(item => !item.completedAt))
  const completedWorkQueueItems = computed(() => workQueueItems.value.filter(item => item.completedAt))
  const queuedActionKeys = computed(() =>
    workQueueItems.value
      .filter(item => item.targetKind === 'action' && !item.completedAt)
      .map(item => item.targetKey),
  )

  function updateItems(items: AnalyzeWorkQueueItem[]) {
    workQueueItems.value = normalizeWorkQueueItems(items)
    writeStoredItems(workQueueItems.value)
  }

  function addWorkQueueItem(item: AnalyzeWorkQueueItem) {
    const existingItem = workQueueItems.value.find(current => current.id === item.id)
    const nextItem = existingItem
      ? { ...existingItem, ...item, createdAt: existingItem.createdAt, completedAt: undefined }
      : item
    updateItems([
      nextItem,
      ...workQueueItems.value.filter(current => current.id !== item.id),
    ])
  }

  function toggleWorkQueueItem(id: string) {
    const now = new Date().toISOString()
    updateItems(workQueueItems.value.map(item => item.id === id
      ? { ...item, completedAt: item.completedAt ? undefined : now }
      : item))
  }

  function removeWorkQueueItem(id: string) {
    updateItems(workQueueItems.value.filter(item => item.id !== id))
  }

  function clearCompletedWorkQueueItems() {
    updateItems(workQueueItems.value.filter(item => !item.completedAt))
  }

  onMounted(() => {
    workQueueItems.value = readStoredItems()
  })

  return {
    completedWorkQueueItems,
    openWorkQueueItems,
    queuedActionKeys,
    workQueueItems,
    addWorkQueueItem,
    clearCompletedWorkQueueItems,
    removeWorkQueueItem,
    toggleWorkQueueItem,
  }
}
