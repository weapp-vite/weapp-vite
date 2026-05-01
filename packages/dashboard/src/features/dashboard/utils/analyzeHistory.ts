import type { AnalyzeComparisonMode, AnalyzeHistorySnapshot, AnalyzeSubpackagesResult } from '../types'

export interface StoredAnalyzeResultHistory {
  current: AnalyzeSubpackagesResult
  previous: AnalyzeSubpackagesResult | null
  snapshots?: AnalyzeHistorySnapshot[]
  baselineSnapshotId?: string | null
  comparisonMode?: AnalyzeComparisonMode
}

const analyzeResultStorageKey = 'weapp-vite-dashboard:analyze-result-history'

export function formatSnapshotLabel(date: Date) {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function createAnalyzeResultKey(result: AnalyzeSubpackagesResult | null | undefined) {
  if (!result) {
    return ''
  }
  return JSON.stringify({
    packages: result.packages,
    modules: result.modules,
    subPackages: result.subPackages,
    budgets: result.metadata?.budgets,
  })
}

export function isSameAnalyzeResult(
  left: AnalyzeSubpackagesResult | null | undefined,
  right: AnalyzeSubpackagesResult | null | undefined,
) {
  return createAnalyzeResultKey(left) === createAnalyzeResultKey(right)
}

export function getAnalyzeResultTotalBytes(result: AnalyzeSubpackagesResult) {
  return result.packages
    .flatMap(pkg => pkg.files)
    .reduce((sum, file) => sum + (file.size ?? 0), 0)
}

export function getAnalyzeResultCompressedBytes(result: AnalyzeSubpackagesResult) {
  return result.packages
    .flatMap(pkg => pkg.files)
    .reduce((sum, file) => sum + (file.brotliSize ?? file.gzipSize ?? Math.round((file.size ?? 0) * 0.32)), 0)
}

function createSnapshotId(result: AnalyzeSubpackagesResult, capturedAt: string) {
  const totalBytes = getAnalyzeResultTotalBytes(result)
  return `${Date.parse(capturedAt).toString(36)}-${totalBytes.toString(36)}-${result.modules.length.toString(36)}`
}

export function createAnalyzeHistorySnapshot(
  result: AnalyzeSubpackagesResult,
  capturedAt = new Date().toISOString(),
): AnalyzeHistorySnapshot {
  const duplicateCount = result.modules.filter(mod => mod.packages.length > 1).length
  return {
    id: createSnapshotId(result, capturedAt),
    capturedAt,
    label: formatSnapshotLabel(new Date(capturedAt)),
    result,
    totalBytes: getAnalyzeResultTotalBytes(result),
    compressedBytes: getAnalyzeResultCompressedBytes(result),
    packageCount: result.packages.length,
    moduleCount: result.modules.length,
    duplicateCount,
  }
}

export function normalizeHistorySnapshots(history: StoredAnalyzeResultHistory): AnalyzeHistorySnapshot[] {
  const snapshots = [...(history.snapshots ?? [])]

  if (history.previous) {
    snapshots.push(createAnalyzeHistorySnapshot(history.previous))
  }
  snapshots.push(createAnalyzeHistorySnapshot(history.current))

  const deduped = new Map<string, AnalyzeHistorySnapshot>()
  for (const snapshot of snapshots) {
    const key = createAnalyzeResultKey(snapshot.result)
    if (!deduped.has(key)) {
      deduped.set(key, snapshot)
    }
  }

  return [...deduped.values()]
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))
    .slice(0, 12)
}

export function readStoredAnalyzeHistory(): StoredAnalyzeResultHistory | null {
  try {
    const raw = window.localStorage.getItem(analyzeResultStorageKey)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as StoredAnalyzeResultHistory
    if (!parsed?.current?.packages || !Array.isArray(parsed.current.packages)) {
      return null
    }
    return {
      current: parsed.current,
      previous: parsed.previous?.packages ? parsed.previous : null,
      snapshots: Array.isArray(parsed.snapshots)
        ? parsed.snapshots.filter(snapshot => snapshot?.result?.packages && Array.isArray(snapshot.result.packages))
        : undefined,
      baselineSnapshotId: typeof parsed.baselineSnapshotId === 'string' ? parsed.baselineSnapshotId : null,
      comparisonMode: parsed.comparisonMode === 'baseline' ? 'baseline' : 'previous',
    }
  }
  catch {
    return null
  }
}

export function writeStoredAnalyzeHistory(history: StoredAnalyzeResultHistory) {
  try {
    window.localStorage.setItem(analyzeResultStorageKey, JSON.stringify(history))
  }
  catch { }
}

export function resolveInitialPreviousResult(
  initialPayload: AnalyzeSubpackagesResult | null,
  initialPreviousPayload: AnalyzeSubpackagesResult | null,
  storedHistory: StoredAnalyzeResultHistory | null,
) {
  if (initialPreviousPayload) {
    return initialPreviousPayload
  }
  if (initialPayload && storedHistory?.current && !isSameAnalyzeResult(initialPayload, storedHistory.current)) {
    return storedHistory.current
  }
  return storedHistory?.previous ?? null
}
