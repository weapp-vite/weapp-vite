import type { AnalyzeActionCenterItem, AnalyzeActionCenterKind, AnalyzeActionCenterTone } from '../types'
import { computed, ref } from 'vue'
import { runtimeBadgeStyles } from '../utils/styles'

export type ActionToneFilter = 'all' | AnalyzeActionCenterTone
export type ActionKindFilter = 'all' | AnalyzeActionCenterKind
export type ActionSortMode = 'priority' | 'severity' | 'title' | 'value'

const toneRank: Record<AnalyzeActionCenterTone, number> = {
  critical: 4,
  warning: 3,
  info: 2,
  success: 1,
}

const actionSortOptions = [
  { label: '按优先级', value: 'priority' },
  { label: '按严重度', value: 'severity' },
  { label: '按标题', value: 'title' },
  { label: '按数值', value: 'value' },
] satisfies Array<{ label: string, value: ActionSortMode }>

interface ActionCenterPanelProps {
  actions: AnalyzeActionCenterItem[]
  queuedActionKeys: string[]
}

export function getActionKindLabel(kind: AnalyzeActionCenterKind) {
  if (kind === 'budget') {
    return '预算'
  }
  if (kind === 'increment') {
    return '增量'
  }
  if (kind === 'duplicate') {
    return '重复'
  }
  return '文件'
}

export function getActionToneClassName(tone: AnalyzeActionCenterTone) {
  if (tone === 'critical') {
    return runtimeBadgeStyles({ tone: 'error' })
  }
  if (tone === 'warning') {
    return runtimeBadgeStyles({ tone: 'warning' })
  }
  if (tone === 'success') {
    return runtimeBadgeStyles({ tone: 'success' })
  }
  return runtimeBadgeStyles({ tone: 'info' })
}

export function getActionToneLabel(tone: AnalyzeActionCenterTone) {
  if (tone === 'critical') {
    return '必须处理'
  }
  if (tone === 'warning') {
    return '建议处理'
  }
  if (tone === 'success') {
    return '可查看'
  }
  return '定位'
}

function sortActionCenterItems(
  items: AnalyzeActionCenterItem[],
  mode: ActionSortMode,
) {
  return [...items].sort((a, b) => {
    if (mode === 'severity') {
      return toneRank[b.tone] - toneRank[a.tone] || b.priority - a.priority || a.title.localeCompare(b.title)
    }
    if (mode === 'title') {
      return a.title.localeCompare(b.title)
    }
    if (mode === 'value') {
      return b.priority - a.priority || String(a.value ?? '').localeCompare(String(b.value ?? '')) || a.title.localeCompare(b.title)
    }
    return b.priority - a.priority || toneRank[b.tone] - toneRank[a.tone] || a.title.localeCompare(b.title)
  })
}

export function useActionCenterPanel(props: ActionCenterPanelProps) {
  const actionQuery = ref('')
  const actionToneFilter = ref<ActionToneFilter>('all')
  const actionKindFilter = ref<ActionKindFilter>('all')
  const actionSortMode = ref<ActionSortMode>('priority')

  const toneOptions = computed(() => {
    const toneSet = new Set<AnalyzeActionCenterTone>()
    for (const item of props.actions) {
      toneSet.add(item.tone)
    }
    return [...toneSet].sort((a, b) => toneRank[b] - toneRank[a])
  })

  const kindOptions = computed(() => {
    const kindSet = new Set<AnalyzeActionCenterKind>()
    for (const item of props.actions) {
      kindSet.add(item.kind)
    }
    return [...kindSet].sort((a, b) => getActionKindLabel(a).localeCompare(getActionKindLabel(b)))
  })

  const toneFilterOptions = computed(() => [
    { label: '全部严重度', value: 'all' as const },
    ...toneOptions.value.map(tone => ({
      label: getActionToneLabel(tone),
      value: tone,
    })),
  ])

  const kindFilterOptions = computed(() => [
    { label: '全部类型', value: 'all' as const },
    ...kindOptions.value.map(kind => ({
      label: getActionKindLabel(kind),
      value: kind,
    })),
  ])

  const filteredActions = computed(() => {
    const keyword = actionQuery.value.trim().toLowerCase()
    const actions = props.actions.filter((item) => {
      if (actionToneFilter.value !== 'all' && item.tone !== actionToneFilter.value) {
        return false
      }
      if (actionKindFilter.value !== 'all' && item.kind !== actionKindFilter.value) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [
        item.key,
        item.kind,
        item.tone,
        item.title,
        item.meta,
        item.value,
        item.tab,
      ].some(value => String(value ?? '').toLowerCase().includes(keyword))
    })
    return sortActionCenterItems(actions, actionSortMode.value)
  })

  function isQueued(item: AnalyzeActionCenterItem) {
    return props.queuedActionKeys.includes(item.key)
  }

  return {
    actionKindFilter,
    actionSortOptions,
    actionQuery,
    actionSortMode,
    actionToneFilter,
    filteredActions,
    kindFilterOptions,
    getKindLabel: getActionKindLabel,
    getToneClassName: getActionToneClassName,
    getToneLabel: getActionToneLabel,
    isQueued,
    toneFilterOptions,
  }
}
