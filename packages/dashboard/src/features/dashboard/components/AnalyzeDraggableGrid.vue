<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import DashboardIcon from './DashboardIcon.vue'

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
      class="relative min-h-0 rounded-lg border border-dashed border-transparent pt-2 transition"
      :class="[item.className, draggingId === item.id ? 'border-(--dashboard-accent) opacity-70' : '']"
      @dragover.prevent
      @drop="handleDrop(item)"
    >
      <div class="absolute inset-x-0 top-0 z-10 flex -translate-y-1/2 items-center justify-center gap-2 px-2">
        <button
          class="inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-strong) text-(--dashboard-text-soft) shadow-(--dashboard-shadow) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
          draggable="true"
          type="button"
          :aria-label="`拖动调整${item.label}模块位置`"
          :title="`拖动调整${item.label}模块位置`"
          @dragend="draggingId = null"
          @dragstart="handleDragStart(item, $event)"
        >
          <span class="h-4 w-4" aria-hidden="true">
            <DashboardIcon name="metric-drag" />
          </span>
        </button>
        <button
          v-if="orderedItems.length > 1 && item.id === orderedItems[0]?.id"
          class="absolute right-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-strong) text-(--dashboard-text-soft) shadow-(--dashboard-shadow) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
          type="button"
          aria-label="重置模块布局"
          title="重置模块布局"
          @click="resetOrder"
        >
          <span class="h-4 w-4" aria-hidden="true">
            <DashboardIcon name="metric-reset" />
          </span>
        </button>
      </div>
      <div class="min-h-0">
        <slot :name="item.id" :item="item" />
      </div>
    </article>
  </section>
</template>
