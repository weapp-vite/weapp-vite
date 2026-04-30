<script setup lang="ts">
import type { AnalyzeCommandPaletteItem, AnalyzeCommandPaletteKind } from '../types'
import { computed, nextTick, ref, watch } from 'vue'
import { runtimeBadgeStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  open: boolean
  items: AnalyzeCommandPaletteItem[]
}>()

const emit = defineEmits<{
  close: []
  select: [item: AnalyzeCommandPaletteItem]
}>()

const searchInputRef = ref<HTMLInputElement>()
const query = ref('')
const activeIndex = ref(0)

const filteredItems = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const items = keyword
    ? props.items.filter(item => `${item.title} ${item.meta} ${item.value ?? ''} ${item.key} ${item.keywords}`.toLowerCase().includes(keyword))
    : props.items
  return items.slice(0, 40)
})

watch(() => props.open, async (open) => {
  if (!open) {
    query.value = ''
    activeIndex.value = 0
    return
  }
  await nextTick()
  searchInputRef.value?.focus()
})

watch(filteredItems, () => {
  activeIndex.value = 0
})

function getKindLabel(kind: AnalyzeCommandPaletteKind) {
  if (kind === 'action') {
    return '动作'
  }
  if (kind === 'budget') {
    return '预算'
  }
  if (kind === 'package') {
    return '包'
  }
  if (kind === 'file') {
    return '文件'
  }
  if (kind === 'increment') {
    return '增量'
  }
  return '模块'
}

function getKindTone(kind: AnalyzeCommandPaletteKind) {
  if (kind === 'action' || kind === 'budget') {
    return runtimeBadgeStyles({ tone: 'warning' })
  }
  if (kind === 'increment') {
    return runtimeBadgeStyles({ tone: 'info' })
  }
  return runtimeBadgeStyles({ tone: 'neutral' })
}

function selectItem(item: AnalyzeCommandPaletteItem) {
  emit('select', item)
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, Math.max(filteredItems.value.length - 1, 0))
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const item = filteredItems.value[activeIndex.value]
    if (item) {
      selectItem(item)
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[70] grid place-items-start bg-slate-950/45 px-3 py-12 backdrop-blur-sm md:px-6 md:py-[9vh]"
        @click.self="emit('close')"
      >
        <section class="mx-auto grid h-[min(42rem,78vh)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-(--dashboard-border-strong) bg-(--dashboard-panel-strong) shadow-2xl">
          <div class="flex items-center gap-3 border-b border-(--dashboard-border) px-4 py-3">
            <span class="h-5 w-5 shrink-0 text-(--dashboard-accent)">
              <DashboardIcon name="metric-search" />
            </span>
            <input
              ref="searchInputRef"
              v-model="query"
              class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-(--dashboard-text-soft)"
              placeholder="搜索包、文件、模块、预算"
              @keydown="handleKeydown"
            >
          </div>

          <div class="min-h-0 overflow-hidden p-2">
            <AppEmptyState v-if="filteredItems.length === 0" compact>
              没有匹配结果。
            </AppEmptyState>

            <ul v-else class="grid max-h-full gap-1 overflow-y-auto pr-1">
              <li
                v-for="(item, index) in filteredItems"
                :key="item.key"
                class="list-none"
              >
                <button
                  type="button"
                  class="w-full rounded-md border px-3 py-2.5 text-left transition"
                  :class="index === activeIndex ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft)' : 'border-transparent hover:border-(--dashboard-border) hover:bg-(--dashboard-panel-muted)'"
                  @mouseenter="activeIndex = index"
                  @click="selectItem(item)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex min-w-0 items-center gap-2">
                        <span :class="getKindTone(item.kind)">
                          {{ getKindLabel(item.kind) }}
                        </span>
                        <p class="truncate font-medium text-(--dashboard-text)">
                          {{ item.title }}
                        </p>
                      </div>
                      <p class="mt-1 truncate text-xs text-(--dashboard-text-soft)">
                        {{ item.meta }}
                      </p>
                    </div>
                    <span
                      v-if="item.value"
                      class="whitespace-nowrap text-sm font-medium text-(--dashboard-accent)"
                    >
                      {{ item.value }}
                    </span>
                  </div>
                </button>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </transition>
  </Teleport>
</template>
