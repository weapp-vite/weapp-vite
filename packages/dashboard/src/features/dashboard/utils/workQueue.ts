import type { AnalyzeActionCenterItem, AnalyzeWorkQueueItem } from '../types'

const targetKinds = ['action', 'file', 'budget']
const tones = ['critical', 'warning', 'info', 'success']
const tabs = ['overview', 'diagnostics', 'treemap', 'files', 'source', 'packages', 'modules']

function createTimestamp() {
  return new Date().toISOString()
}

function isKnownValue(value: unknown, values: string[]) {
  return typeof value === 'string' && values.includes(value)
}

function isWorkQueueItem(value: unknown): value is AnalyzeWorkQueueItem {
  if (!value || typeof value !== 'object') {
    return false
  }
  const item = value as Partial<AnalyzeWorkQueueItem>
  return typeof item.id === 'string'
    && isKnownValue(item.targetKind, targetKinds)
    && typeof item.targetKey === 'string'
    && typeof item.title === 'string'
    && typeof item.meta === 'string'
    && isKnownValue(item.tone, tones)
    && isKnownValue(item.tab, tabs)
    && typeof item.createdAt === 'string'
}

export function normalizeWorkQueueItems(value: unknown): AnalyzeWorkQueueItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  const itemMap = new Map<string, AnalyzeWorkQueueItem>()
  for (const item of value) {
    if (!isWorkQueueItem(item)) {
      continue
    }
    itemMap.set(item.id, {
      id: item.id,
      targetKind: item.targetKind,
      targetKey: item.targetKey,
      title: item.title,
      meta: item.meta,
      value: typeof item.value === 'string' ? item.value : undefined,
      tone: item.tone,
      tab: item.tab,
      createdAt: item.createdAt,
      completedAt: typeof item.completedAt === 'string' ? item.completedAt : undefined,
    })
  }

  return [...itemMap.values()].sort((a, b) => {
    if (Boolean(a.completedAt) !== Boolean(b.completedAt)) {
      return a.completedAt ? 1 : -1
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}

export function createActionWorkQueueItem(
  action: AnalyzeActionCenterItem,
  createdAt = createTimestamp(),
): AnalyzeWorkQueueItem {
  return {
    id: `action:${action.key}`,
    targetKind: 'action',
    targetKey: action.key,
    title: action.title,
    meta: action.meta,
    value: action.value,
    tone: action.tone,
    tab: action.tab,
    createdAt,
  }
}

export function createWorkQueueMarkdown(items: AnalyzeWorkQueueItem[]) {
  const rows = normalizeWorkQueueItems(items).map((item) => {
    const status = item.completedAt ? '完成' : '待处理'
    return `| ${status} | ${item.title.replaceAll('|', '\\|')} | ${item.meta.replaceAll('|', '\\|')} | ${item.value ?? '-'} | ${item.tab} |`
  })

  return [
    '# dashboard 处理清单',
    '',
    `待处理：${items.filter(item => !item.completedAt).length}`,
    `已完成：${items.filter(item => item.completedAt).length}`,
    '',
    '| 状态 | 事项 | 说明 | 数值 | 视图 |',
    '| --- | --- | --- | ---: | --- |',
    rows.join('\n') || '| - | 暂无事项 | - | - | - |',
    '',
  ].join('\n')
}
