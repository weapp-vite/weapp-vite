import type { SetDataDebugInfo } from 'wevu'
import type { BenchMetrics, BenchSetDataDiagnosticsSummary, SetDataCounter } from '../../utils/bench'
import { nextTick, onLoad, onReady } from 'wevu'
import {
  createBenchCards,
  createEmptyMetrics,
  createSetDataDiagnosticsTracker,
  mutateBenchCards,
  now,
  patchSetData,
  recordSetDataDebugEvent,
  recordSetDataFlushEvent,
  resetSetDataDiagnosticsTracker,
  summarizeBenchCards,
  summarizeSetDataDiagnostics,
  UPDATE_CARD_COUNT,
} from '../../utils/bench'

export interface UpdateBenchPageOptions {
  strategyLabel: string
  title: string
}

function createEmptyDiagnosticsSummary(): BenchSetDataDiagnosticsSummary {
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

function buildSnapshot(data: {
  cards: unknown[]
  metrics: BenchMetrics
  readyMarker: string
  summary: string
}, setDataCounter: SetDataCounter) {
  return {
    readyMarker: data.readyMarker,
    cardCount: data.cards.length,
    summary: data.summary,
    metrics: data.metrics,
    totalSetDataCalls: setDataCounter.total,
  }
}

function buildUpdateSnapshot(data: {
  cards: unknown[]
  metrics: BenchMetrics
  readyMarker: string
  summary: string
  setDataDiagnostics: {
    singleCommit: BenchSetDataDiagnosticsSummary
    microCommit: BenchSetDataDiagnosticsSummary
  }
  strategyLabel: string
}, setDataCounter: SetDataCounter) {
  return {
    readyMarker: data.readyMarker,
    cardCount: data.cards.length,
    summary: data.summary,
    metrics: data.metrics,
    totalSetDataCalls: setDataCounter.total,
    setDataDiagnostics: data.setDataDiagnostics,
    strategyLabel: data.strategyLabel,
  }
}

export function createUpdateBenchData(options: UpdateBenchPageOptions) {
  return () => ({
    title: options.title,
    readyMarker: '',
    summary: '',
    cards: [] as any[],
    metrics: createEmptyMetrics(),
    totalSetDataCalls: 0,
    strategyLabel: options.strategyLabel,
    setDataDiagnostics: {
      singleCommit: createEmptyDiagnosticsSummary(),
      microCommit: createEmptyDiagnosticsSummary(),
    },
  })
}

export function createUpdateBenchDebug(options: {
  tracker: ReturnType<typeof createSetDataDiagnosticsTracker>
}) {
  return (info: SetDataDebugInfo) => {
    recordSetDataDebugEvent(options.tracker, info)
  }
}

export function createUpdateBenchSetup(options: {
  strategyLabel: string
  tracker: ReturnType<typeof createSetDataDiagnosticsTracker>
}) {
  const setDataCounter: SetDataCounter = {
    total: 0,
    firstCommitAt: null,
  }

  return (_props: any, ctx: any) => {
    const state = ctx.state as any
    const instance = ctx.instance as any
    let loadStartedAt = 0

    const resetSetDataDiagnostics = () => {
      resetSetDataDiagnosticsTracker(options.tracker)
    }

    patchSetData(instance, setDataCounter, () => {
      recordSetDataFlushEvent(options.tracker)
    })

    onLoad(() => {
      loadStartedAt = now()
      setDataCounter.total = 0
      setDataCounter.firstCommitAt = null
      resetSetDataDiagnostics()
      patchSetData(instance, setDataCounter, () => {
        recordSetDataFlushEvent(options.tracker)
      })

      const cards = createBenchCards(11, UPDATE_CARD_COUNT)
      state.readyMarker = 'vue-update-ready'
      state.summary = summarizeBenchCards(cards)
      state.cards = cards
      state.metrics = createEmptyMetrics()
      state.totalSetDataCalls = 0
      state.strategyLabel = options.strategyLabel
      state.setDataDiagnostics = {
        singleCommit: createEmptyDiagnosticsSummary(),
        microCommit: createEmptyDiagnosticsSummary(),
      }
    })

    onReady(() => {
      state.metrics = {
        ...state.metrics,
        loadToReadyMs: now() - loadStartedAt,
        firstCommitMs: setDataCounter.firstCommitAt ? setDataCounter.firstCommitAt - loadStartedAt : 0,
      }
      state.totalSetDataCalls = setDataCounter.total
    })

    async function readBenchState() {
      state.totalSetDataCalls = setDataCounter.total
      return buildSnapshot(state, setDataCounter)
    }

    async function runSingleCommitBench(rounds = 180) {
      resetSetDataDiagnostics()
      const startCalls = setDataCounter.total
      const startAt = now()
      let cards = state.cards
      const computeStartedAt = now()

      for (let index = 0; index < rounds; index += 1) {
        cards = mutateBenchCards(cards, index + 1)
      }
      const computeMs = now() - computeStartedAt

      const dispatchStartedAt = now()
      state.cards = cards
      state.summary = summarizeBenchCards(cards)
      const dispatchMs = now() - dispatchStartedAt

      const flushStartedAt = now()
      await nextTick()
      const flushMs = now() - flushStartedAt
      const commitMs = dispatchMs + flushMs

      state.metrics = {
        ...state.metrics,
        singleCommitMs: now() - startAt,
        singleCommitComputeMs: computeMs,
        singleCommitCommitMs: commitMs,
        singleCommitDispatchMs: dispatchMs,
        singleCommitFlushMs: flushMs,
        singleCommitSetDataCalls: setDataCounter.total - startCalls,
      }
      state.totalSetDataCalls = setDataCounter.total
      state.setDataDiagnostics = {
        ...state.setDataDiagnostics,
        singleCommit: summarizeSetDataDiagnostics(options.tracker),
      }

      return buildUpdateSnapshot(state, setDataCounter)
    }

    async function runMicroCommitBench(rounds = 40) {
      resetSetDataDiagnostics()
      const startCalls = setDataCounter.total
      const startAt = now()
      let cards = state.cards
      let computeMs = 0
      let dispatchMs = 0
      let flushMs = 0

      for (let index = 0; index < rounds; index += 1) {
        const computeStartedAt = now()
        cards = mutateBenchCards(cards, index + 1)
        computeMs += now() - computeStartedAt

        const dispatchStartedAt = now()
        state.cards = cards
        state.summary = summarizeBenchCards(cards)
        dispatchMs += now() - dispatchStartedAt

        const flushStartedAt = now()
        await nextTick()
        flushMs += now() - flushStartedAt
      }
      const commitMs = dispatchMs + flushMs

      state.metrics = {
        ...state.metrics,
        microCommitMs: now() - startAt,
        microCommitComputeMs: computeMs,
        microCommitCommitMs: commitMs,
        microCommitDispatchMs: dispatchMs,
        microCommitFlushMs: flushMs,
        microCommitSetDataCalls: setDataCounter.total - startCalls,
      }
      state.totalSetDataCalls = setDataCounter.total
      state.setDataDiagnostics = {
        ...state.setDataDiagnostics,
        microCommit: summarizeSetDataDiagnostics(options.tracker),
      }

      return buildUpdateSnapshot(state, setDataCounter)
    }

    return {
      readBenchState,
      runSingleCommitBench,
      runMicroCommitBench,
    }
  }
}

export function createUpdateBenchTracker() {
  return createSetDataDiagnosticsTracker()
}
