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
const kindFilter = ref<'all' | AnalyzeCommandPaletteKind>('all')

const kindOptions: Array<{ value: 'all' | AnalyzeCommandPaletteKind, label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'action', label: '动作' },
  { value: 'budget', label: '预算' },
  { value: 'package', label: '包' },
  { value: 'file', label: '文件' },
  { value: 'module', label: '模块' },
  { value: 'increment', label: '增量' },
]

const kindLabels: Record<AnalyzeCommandPaletteKind, string> = {
  action: '动作',
  budget: '预算',
  package: '包',
  file: '文件',
  increment: '增量',
  module: '模块',
}

const kindToneNames: Record<AnalyzeCommandPaletteKind, 'warning' | 'info' | 'neutral'> = {
  action: 'warning',
  budget: 'warning',
  package: 'neutral',
  file: 'neutral',
  module: 'neutral',
  increment: 'info',
}

const filteredItems = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const items = props.items.filter((item) => {
    if (kindFilter.value !== 'all' && item.kind !== kindFilter.value) {
      return false
    }

    if (!keyword) {
      return true
    }

    return `${item.title} ${item.meta} ${item.value ?? ''} ${item.key} ${item.keywords}`.toLowerCase().includes(keyword)
  })
  return items.slice(0, 40)
})

const selectedItem = computed(() => filteredItems.value[activeIndex.value] ?? null)

const resultSummary = computed(() => {
  const kindText = kindFilter.value === 'all' ? '全部类型' : kindLabels[kindFilter.value]
  return `匹配 ${filteredItems.value.length} / ${props.items.length} 项 · ${kindText}`
})

watch(() => props.open, async (open) => {
  if (!open) {
    query.value = ''
    kindFilter.value = 'all'
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
  return kindLabels[kind]
}

function getKindTone(kind: AnalyzeCommandPaletteKind) {
  return runtimeBadgeStyles({ tone: kindToneNames[kind] })
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
        <section class="mx-auto grid h-[min(44rem,82vh)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-(--dashboard-border-strong) bg-(--dashboard-panel-strong) shadow-2xl">
          <div class="grid gap-3 border-b border-(--dashboard-border) px-4 py-3">
            <div class="flex items-center gap-3">
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

            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs text-(--dashboard-text-soft)">
                {{ resultSummary }}
              </p>
              <select
                v-model="kindFilter"
                class="h-8 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-border-strong)"
              >
                <option
                  v-for="option in kindOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid min-h-0 gap-2 overflow-hidden p-2 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.52fr)]">
            <AppEmptyState v-if="filteredItems.length === 0" compact>
              没有匹配结果。
            </AppEmptyState>

            <ul v-else class="grid max-h-full min-h-0 gap-1 overflow-y-auto pr-1">
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

            <aside class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-[11px] uppercase tracking-[0.2em] text-(--dashboard-accent)">
                    Preview
                  </p>
                  <h3 class="mt-1 text-base font-semibold">
                    当前命令
                  </h3>
                </div>
                <span
                  v-if="selectedItem"
                  :class="getKindTone(selectedItem.kind)"
                >
                  {{ getKindLabel(selectedItem.kind) }}
                </span>
              </div>

              <AppEmptyState v-if="!selectedItem" compact>
                选择左侧结果后查看目标和跳转位置。
              </AppEmptyState>

              <div v-else class="grid min-h-0 content-start gap-3 overflow-y-auto">
                <div>
                  <h4 class="font-medium">
                    {{ selectedItem.title }}
                  </h4>
                  <p class="mt-1 text-sm leading-6 text-(--dashboard-text-muted)">
                    {{ selectedItem.meta }}
                  </p>
                </div>
                <div class="grid gap-2 text-sm">
                  <div class="flex items-center justify-between gap-3 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2">
                    <span class="text-xs uppercase tracking-[0.16em] text-(--dashboard-text-soft)">Tab</span>
                    <strong>{{ selectedItem.tab }}</strong>
                  </div>
                  <div
                    v-if="selectedItem.value"
                    class="flex items-center justify-between gap-3 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2"
                  >
                    <span class="text-xs uppercase tracking-[0.16em] text-(--dashboard-text-soft)">Value</span>
                    <strong class="text-(--dashboard-accent)">{{ selectedItem.value }}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  class="inline-flex h-9 items-center justify-center rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm font-medium text-(--dashboard-text) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none"
                  @click="selectItem(selectedItem)"
                >
                  跳转到结果
                </button>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </transition>
  </Teleport>
</template>
