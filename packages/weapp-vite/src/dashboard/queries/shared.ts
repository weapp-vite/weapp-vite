import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import type { SerializedDashboardAnalyzeSnapshot } from '../payload'

export type ReadDashboardQuerySnapshot = (revision: number) => SerializedDashboardAnalyzeSnapshot

export function selectAnalyzeReport(read: ReadDashboardQuerySnapshot, request: { revision: number, target: 'current' | 'previous' }) {
  const snapshot = read(request.revision)
  const payload = snapshot[request.target]
  if (!payload) {
    throw new Error('没有上一份分析快照。')
  }
  return {
    result: payload.source,
    context: { revision: request.revision, target: request.target, reportHash: payload.descriptor.hash },
    previousAvailable: snapshot.previous !== null,
  }
}

export function matchesQuery(query: string | undefined, ...values: Array<string | undefined>) {
  if (!query) {
    return true
  }
  const needle = query.toLowerCase()
  return values.some(value => value?.toLowerCase().includes(needle))
}

export function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

export function ordered(value: number, order: 'asc' | 'desc') {
  return order === 'asc' ? value : -value
}

export function paginate<T>(items: T[], request: { offset: number, limit: number }) {
  const end = Math.min(request.offset + request.limit, items.length)
  return {
    total: items.length,
    offset: request.offset,
    nextOffset: end < items.length ? end : null,
    items: items.slice(request.offset, end),
  }
}

export function reportTotals(result: AnalyzeSubpackagesResult) {
  let bytes = 0
  let files = 0
  let unmeasuredFiles = 0
  for (const pkg of result.packages) {
    files += pkg.files.length
    for (const file of pkg.files) {
      bytes += file.size ?? 0
      unmeasuredFiles += file.size === undefined ? 1 : 0
    }
  }
  return { packages: result.packages.length, files, modules: result.modules.length, bytes, unmeasuredFiles }
}

/** 模块归属以报告的 usage 为准；资源源码不一定出现在 chunk 的贡献列表中。 */
export function createModulePlacementIndex(result: AnalyzeSubpackagesResult) {
  const index = new Map<string, { moduleIds: Set<string>, files: Map<string, Set<string>> }>()
  for (const module of result.modules) {
    for (const usage of module.packages) {
      let placement = index.get(usage.packageId)
      if (!placement) {
        placement = { moduleIds: new Set(), files: new Map() }
        index.set(usage.packageId, placement)
      }
      placement.moduleIds.add(module.id)
      for (const file of usage.files) {
        let modules = placement.files.get(file)
        if (!modules) {
          modules = new Set()
          placement.files.set(file, modules)
        }
        modules.add(module.id)
      }
    }
  }
  return index
}
