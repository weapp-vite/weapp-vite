import type { AnalyzeCommandPaletteItem, AnalyzeCommandPaletteKind } from '../types'
import { computed, nextTick, ref, watch } from 'vue'
import { runtimeBadgeStyles } from '../utils/styles'

export type AnalyzeCommandPaletteFilter = 'all' | AnalyzeCommandPaletteKind

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

export const analyzeCommandPaletteKindOptions: Array<{ value: AnalyzeCommandPaletteFilter, label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'action', label: '动作' },
  { value: 'budget', label: '预算' },
  { value: 'package', label: '包' },
  { value: 'file', label: '文件' },
  { value: 'module', label: '模块' },
  { value: 'increment', label: '增量' },
]

interface AnalyzeCommandPaletteDialogProps {
  open: boolean
  items: AnalyzeCommandPaletteItem[]
}

interface AnalyzeCommandPaletteDialogEmit {
  (event: 'close'): void
  (event: 'select', item: AnalyzeCommandPaletteItem): void
}

export function useAnalyzeCommandPaletteDialog(
  props: AnalyzeCommandPaletteDialogProps,
  emit: AnalyzeCommandPaletteDialogEmit,
) {
  const searchInputRef = ref<HTMLInputElement>()
  const query = ref('')
  const activeIndex = ref(0)
  const kindFilter = ref<AnalyzeCommandPaletteFilter>('all')

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

  return {
    activeIndex,
    filteredItems,
    getKindLabel,
    getKindTone,
    handleKeydown,
    kindFilter,
    kindOptions: analyzeCommandPaletteKindOptions,
    query,
    resultSummary,
    searchInputRef,
    selectedItem,
    selectItem,
  }
}
