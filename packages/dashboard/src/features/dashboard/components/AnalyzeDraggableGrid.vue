<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'

interface AnalyzeDraggableGridItem {
  id: string
  label: string
  className?: string
}

const props = defineProps<{
  items: AnalyzeDraggableGridItem[]
  storageKey: string
  gridClass: string
}>()

const order = shallowRef<string[]>([])
const draggingId = shallowRef<string | null>(null)

const itemMap = computed(() => new Map(props.items.map(item => [item.id, item])))
const orderedItems = computed(() => {
  const knownIds = new Set(props.items.map(item => item.id))
  const storedItems = order.value
    .filter(id => knownIds.has(id))
    .map(id => itemMap.value.get(id))
    .filter((item): item is AnalyzeDraggableGridItem => Boolean(item))
  const missingItems = props.items.filter(item => !order.value.includes(item.id))
  return [...storedItems, ...missingItems]
})

function readOrder() {
  try {
    const raw = window.localStorage.getItem(props.storageKey)
    const parsed = raw ? JSON.parse(raw) : null
    order.value = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : props.items.map(item => item.id)
  }
  catch {
    order.value = props.items.map(item => item.id)
  }
}

function writeOrder(nextOrder: string[]) {
  order.value = nextOrder
  window.localStorage.setItem(props.storageKey, JSON.stringify(nextOrder))
}

function handleDragStart(item: AnalyzeDraggableGridItem, event: DragEvent) {
  draggingId.value = item.id
  event.dataTransfer?.setData('text/plain', item.id)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function handleDrop(target: AnalyzeDraggableGridItem) {
  const sourceId = draggingId.value
  draggingId.value = null
  if (!sourceId || sourceId === target.id) {
    return
  }
  const currentIds = orderedItems.value.map(item => item.id)
  const sourceIndex = currentIds.indexOf(sourceId)
  const targetIndex = currentIds.indexOf(target.id)
  if (sourceIndex < 0 || targetIndex < 0) {
    return
  }
  currentIds.splice(sourceIndex, 1)
  currentIds.splice(targetIndex, 0, sourceId)
  writeOrder(currentIds)
}

function resetOrder() {
  writeOrder(props.items.map(item => item.id))
}

onMounted(readOrder)

watch(
  () => props.items.map(item => item.id).join('\u0000'),
  readOrder,
)
</script>

<template>
  <section :class="gridClass">
    <article
      v-for="item in orderedItems"
      :key="item.id"
      class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-dashed border-transparent transition"
      :class="[item.className, draggingId === item.id ? 'border-(--dashboard-accent) opacity-70' : '']"
      @dragover.prevent
      @drop="handleDrop(item)"
    >
      <div class="flex min-h-0 items-center justify-between gap-2 pb-1">
        <button
          class="inline-flex min-w-0 cursor-grab items-center gap-2 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
          draggable="true"
          type="button"
          @dragend="draggingId = null"
          @dragstart="handleDragStart(item, $event)"
        >
          <span aria-hidden="true">::</span>
          <span class="truncate">{{ item.label }}</span>
        </button>
        <button
          v-if="orderedItems.length > 1 && item.id === orderedItems[0]?.id"
          class="shrink-0 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2 py-1 text-[11px] text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
          type="button"
          @click="resetOrder"
        >
          重置布局
        </button>
      </div>
      <div class="min-h-0 overflow-hidden">
        <slot :name="item.id" :item="item" />
      </div>
    </article>
  </section>
</template>
