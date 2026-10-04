import type { AnalyzeSubpackagesResult, IncrementAttributionEntry, IncrementAttributionSummary } from '../types'
import { createAnalyzeComparison } from 'weapp-vite/dashboard/analyze'
import { formatModuleIdentifier } from './format'

export function createIncrementAttribution(options: {
  result: AnalyzeSubpackagesResult | null
  previousResult?: AnalyzeSubpackagesResult | null
}): IncrementAttributionEntry[] {
  if (!options.result || !options.previousResult) {
    return []
  }
  const comparison = createAnalyzeComparison(options.result, options.previousResult)
  return [...comparison.files, ...comparison.modules]
    .filter((item): item is typeof item & { currentBytes: number, previousBytes: number, deltaBytes: number } =>
      item.currentBytes !== null && item.previousBytes !== null && item.deltaBytes !== null && item.deltaBytes > 0,
    )
    .map((item): IncrementAttributionEntry => ({
      key: item.moduleId === undefined ? `file:${item.packageId}:${item.file}` : `module:${item.moduleId}`,
      label: item.moduleId === undefined ? item.label : formatModuleIdentifier(item.label),
      category: item.category ?? '',
      packageId: item.packageId,
      packageLabel: item.packageLabel ?? '',
      file: item.file,
      moduleId: item.moduleId,
      sourceType: item.sourceType,
      currentBytes: item.currentBytes,
      previousBytes: item.previousBytes,
      deltaBytes: item.deltaBytes,
      advice: item.advice ?? '',
    }))
    .sort((a, b) =>
      b.deltaBytes - a.deltaBytes
      || a.category.localeCompare(b.category)
      || a.label.localeCompare(b.label),
    )
}

export function createIncrementSummary(items: IncrementAttributionEntry[]): IncrementAttributionSummary[] {
  const map = new Map<string, IncrementAttributionSummary>()
  for (const item of items) {
    const entry = map.get(item.category) ?? {
      category: item.category,
      count: 0,
      deltaBytes: 0,
    }
    entry.count += 1
    entry.deltaBytes += item.deltaBytes
    map.set(item.category, entry)
  }
  return [...map.values()]
    .sort((a, b) => b.deltaBytes - a.deltaBytes || b.count - a.count || a.category.localeCompare(b.category))
}
