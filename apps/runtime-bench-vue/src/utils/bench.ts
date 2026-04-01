import type { SetDataDebugInfo } from 'wevu'

export interface BenchCard {
  id: string
  title: string
  summary: string
  score: number
  delta: number
  active: boolean
  tags: string[]
}

export interface BenchMetrics {
  loadToReadyMs: number
  firstCommitMs: number
  singleCommitMs: number
  singleCommitComputeMs: number
  singleCommitCommitMs: number
  singleCommitDispatchMs: number
  singleCommitFlushMs: number
  singleCommitSetDataCalls: number
  microCommitMs: number
  microCommitComputeMs: number
  microCommitCommitMs: number
  microCommitDispatchMs: number
  microCommitFlushMs: number
  microCommitSetDataCalls: number
}

export interface SetDataCounter {
  total: number
  firstCommitAt: number | null
}

export interface BenchSetDataDiagnosticsSummary {
  flushes: number
  patchFlushes: number
  diffFlushes: number
  fallbackFlushes: number
  fallbackReasons: Partial<Record<Exclude<SetDataDebugInfo['reason'], 'patch' | 'diff'>, number>>
  avgPayloadKeys: number
  maxPayloadKeys: number
  avgPendingPatchKeys: number
  maxPendingPatchKeys: number
  avgBytes: number
  maxBytes: number
  avgComputedDirtyKeys: number
  maxComputedDirtyKeys: number
  avgMergedSiblingParents: number
  maxMergedSiblingParents: number
}

interface BenchSetDataDebugEvent {
  seq: number
  info: SetDataDebugInfo
}

interface BenchSetDataFlushEvent {
  seq: number
}

export interface BenchSetDataDiagnosticsTracker {
  nextSeq: number
  debugEvents: BenchSetDataDebugEvent[]
  flushEvents: BenchSetDataFlushEvent[]
}

function roundAverage(total: number, count: number) {
  if (!count) {
    return 0
  }
  return Math.round((total / count) * 100) / 100
}

function createEmptySetDataDiagnosticsSummary(): BenchSetDataDiagnosticsSummary {
  return {
    flushes: 0,
    patchFlushes: 0,
    diffFlushes: 0,
    fallbackFlushes: 0,
    fallbackReasons: {},
    avgPayloadKeys: 0,
    maxPayloadKeys: 0,
    avgPendingPatchKeys: 0,
    maxPendingPatchKeys: 0,
    avgBytes: 0,
    maxBytes: 0,
    avgComputedDirtyKeys: 0,
    maxComputedDirtyKeys: 0,
    avgMergedSiblingParents: 0,
    maxMergedSiblingParents: 0,
  }
}

export function createSetDataDiagnosticsTracker(): BenchSetDataDiagnosticsTracker {
  return {
    nextSeq: 0,
    debugEvents: [],
    flushEvents: [],
  }
}

export function resetSetDataDiagnosticsTracker(tracker: BenchSetDataDiagnosticsTracker) {
  tracker.nextSeq = 0
  tracker.debugEvents.length = 0
  tracker.flushEvents.length = 0
}

export function recordSetDataDebugEvent(tracker: BenchSetDataDiagnosticsTracker, info: SetDataDebugInfo) {
  tracker.debugEvents.push({
    seq: tracker.nextSeq++,
    info,
  })
}

export function recordSetDataFlushEvent(tracker: BenchSetDataDiagnosticsTracker) {
  tracker.flushEvents.push({
    seq: tracker.nextSeq++,
  })
}

function isRichDebugInfo(info: SetDataDebugInfo) {
  return info.bytes !== undefined
    || info.estimatedBytes !== undefined
    || info.computedDirtyKeys !== undefined
    || info.mergedSiblingParents !== undefined
}

export function summarizeSetDataDiagnostics(tracker: BenchSetDataDiagnosticsTracker): BenchSetDataDiagnosticsSummary {
  if (!tracker.flushEvents.length) {
    return createEmptySetDataDiagnosticsSummary()
  }

  const summary = createEmptySetDataDiagnosticsSummary()
  const consumedDebugIndexes = new Set<number>()
  let totalPayloadKeys = 0
  let totalPendingPatchKeys = 0
  let totalBytes = 0
  let totalComputedDirtyKeys = 0
  let totalMergedSiblingParents = 0

  const pickDebugInfo = (flushSeq: number) => {
    let candidateIndex = -1

    for (let index = tracker.debugEvents.length - 1; index >= 0; index -= 1) {
      if (consumedDebugIndexes.has(index)) {
        continue
      }
      const event = tracker.debugEvents[index]
      if (event.seq >= flushSeq) {
        continue
      }
      if (isRichDebugInfo(event.info)) {
        candidateIndex = index
        break
      }
    }

    if (candidateIndex >= 0) {
      consumedDebugIndexes.add(candidateIndex)
      return tracker.debugEvents[candidateIndex]!.info
    }

    for (let index = 0; index < tracker.debugEvents.length; index += 1) {
      if (consumedDebugIndexes.has(index)) {
        continue
      }
      const event = tracker.debugEvents[index]
      if (event.seq <= flushSeq) {
        continue
      }
      candidateIndex = index
      break
    }

    if (candidateIndex >= 0) {
      consumedDebugIndexes.add(candidateIndex)
      return tracker.debugEvents[candidateIndex]!.info
    }

    return undefined
  }

  for (const flushEvent of tracker.flushEvents) {
    const info = pickDebugInfo(flushEvent.seq)
    summary.flushes += 1
    if (!info) {
      continue
    }

    if (info.mode === 'patch') {
      summary.patchFlushes += 1
    }
    else {
      summary.diffFlushes += 1
    }

    if (info.reason !== 'patch' && info.reason !== 'diff') {
      summary.fallbackFlushes += 1
      summary.fallbackReasons[info.reason] = (summary.fallbackReasons[info.reason] ?? 0) + 1
    }

    totalPayloadKeys += info.payloadKeys
    totalPendingPatchKeys += info.pendingPatchKeys
    totalBytes += info.bytes ?? info.estimatedBytes ?? 0
    totalComputedDirtyKeys += info.computedDirtyKeys ?? 0
    totalMergedSiblingParents += info.mergedSiblingParents ?? 0

    summary.maxPayloadKeys = Math.max(summary.maxPayloadKeys, info.payloadKeys)
    summary.maxPendingPatchKeys = Math.max(summary.maxPendingPatchKeys, info.pendingPatchKeys)
    summary.maxBytes = Math.max(summary.maxBytes, info.bytes ?? info.estimatedBytes ?? 0)
    summary.maxComputedDirtyKeys = Math.max(summary.maxComputedDirtyKeys, info.computedDirtyKeys ?? 0)
    summary.maxMergedSiblingParents = Math.max(summary.maxMergedSiblingParents, info.mergedSiblingParents ?? 0)
  }

  summary.avgPayloadKeys = roundAverage(totalPayloadKeys, summary.flushes)
  summary.avgPendingPatchKeys = roundAverage(totalPendingPatchKeys, summary.flushes)
  summary.avgBytes = roundAverage(totalBytes, summary.flushes)
  summary.avgComputedDirtyKeys = roundAverage(totalComputedDirtyKeys, summary.flushes)
  summary.avgMergedSiblingParents = roundAverage(totalMergedSiblingParents, summary.flushes)

  return summary
}

export const INDEX_CARD_COUNT = 120
export const DETAIL_CARD_COUNT = 180
export const UPDATE_CARD_COUNT = 100

export function now() {
  return Date.now()
}

export function createBenchCards(seed: number, count: number): BenchCard[] {
  return Array.from({ length: count }, (_, index) => {
    const rank = seed * 13 + index * 7
    return {
      id: `card-${seed}-${index}`,
      title: `Benchmark Card ${index + 1}`,
      summary: `seed=${seed} rank=${rank % 97} lane=${index % 5}`,
      score: (rank * 17) % 1000,
      delta: (rank % 19) - 9,
      active: (index + seed) % 4 === 0,
      tags: [
        `lane-${index % 5}`,
        `seed-${seed % 7}`,
        (index + seed) % 2 === 0 ? 'hot' : 'warm',
      ],
    }
  })
}

export function mutateBenchCards(cards: BenchCard[], step: number): BenchCard[] {
  return cards.map((card, index) => {
    const nextScore = (card.score + step + index * 3) % 1000
    const nextDelta = ((card.delta + step + index) % 21) - 10
    const nextActive = (index + step) % 5 === 0
    return {
      ...card,
      score: nextScore,
      delta: nextDelta,
      active: nextActive,
      summary: `step=${step} rank=${(nextScore + nextDelta + index) % 113} lane=${index % 5}`,
      tags: [
        `lane-${index % 5}`,
        `step-${step % 9}`,
        nextActive ? 'hot' : 'warm',
      ],
    }
  })
}

export function summarizeBenchCards(cards: BenchCard[]) {
  const activeCount = cards.filter(card => card.active).length
  const checksum = cards.reduce((total, card) => total + card.score + card.delta, 0)
  return `cards=${cards.length} active=${activeCount} checksum=${checksum}`
}

export function createEmptyMetrics(): BenchMetrics {
  return {
    loadToReadyMs: 0,
    firstCommitMs: 0,
    singleCommitMs: 0,
    singleCommitComputeMs: 0,
    singleCommitCommitMs: 0,
    singleCommitDispatchMs: 0,
    singleCommitFlushMs: 0,
    singleCommitSetDataCalls: 0,
    microCommitMs: 0,
    microCommitComputeMs: 0,
    microCommitCommitMs: 0,
    microCommitDispatchMs: 0,
    microCommitFlushMs: 0,
    microCommitSetDataCalls: 0,
  }
}

export function patchSetData(instance: any, counter: SetDataCounter, onFlush?: () => void) {
  if (!instance || typeof instance.setData !== 'function' || instance.__benchPatchedSetData) {
    return
  }
  const rawSetData = instance.setData.bind(instance)
  instance.__benchPatchedSetData = true
  instance.setData = (payload: Record<string, any>, callback?: () => void) => {
    counter.total += 1
    if (counter.firstCommitAt === null) {
      counter.firstCommitAt = now()
    }
    onFlush?.()
    return rawSetData(payload, callback)
  }
}
