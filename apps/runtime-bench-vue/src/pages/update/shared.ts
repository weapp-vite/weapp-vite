import type { SetDataDebugInfo } from 'wevu'
import type { SetDataCounter } from '../../utils/bench'
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

type Workload = 'replace' | 'frequent' | 'small-field' | 'batch' | 'append' | 'reorder'

export function createUpdateBenchData(options: UpdateBenchPageOptions) {
  return () => ({
    title: options.title,
    readyMarker: '',
    summary: '',
    cards: [] as any[],
    metrics: createEmptyMetrics(),
    totalSetDataCalls: 0,
    strategyLabel: options.strategyLabel,
  })
}

export function createUpdateBenchDebug(options: {
  tracker: ReturnType<typeof createSetDataDiagnosticsTracker>
}) {
  return (info: SetDataDebugInfo) => recordSetDataDebugEvent(options.tracker, info)
}

export function createUpdateBenchSetup(options: {
  strategyLabel: string
  tracker: ReturnType<typeof createSetDataDiagnosticsTracker>
}) {
  return (_props: any, ctx: any) => {
    const state = ctx.state as any
    const instance = ctx.instance as any
    const counter: SetDataCounter = { total: 0, firstCommitAt: null }
    let loadStartedAt = 0
    let lastRun: {
      workload: Workload
      prefix: 'singleCommit' | 'microCommit'
      computeMs: number
      assignmentMs: number
      schedulerFlushMs: number
      elapsedMs: number
      startCalls: number
    } | undefined

    patchSetData(instance, counter, () => recordSetDataFlushEvent(options.tracker))

    onLoad(() => {
      loadStartedAt = now()
      counter.total = 0
      counter.firstCommitAt = null
      resetSetDataDiagnosticsTracker(options.tracker)
      const cards = createBenchCards(11, UPDATE_CARD_COUNT)
      state.readyMarker = 'vue-update-ready'
      state.summary = summarizeBenchCards(cards)
      state.cards = cards
      state.metrics = createEmptyMetrics()
      state.strategyLabel = options.strategyLabel
    })

    onReady(() => {
      state.metrics = { ...state.metrics, loadToReadyMs: now() - loadStartedAt }
    })

    function readBenchState() {
      const diagnostics = summarizeSetDataDiagnostics(options.tracker)
      // 观测结果保留在闭包中；读取或汇总指标不能再向被测页面下发 setData。
      return {
        readyMarker: state.readyMarker,
        cardCount: state.cards.length,
        firstCardTitle: state.cards[0]?.title,
        summary: state.summary,
        metrics: {
          ...state.metrics,
          ...(lastRun
            ? {
                [`${lastRun.prefix}Ms`]: lastRun.elapsedMs,
                [`${lastRun.prefix}ComputeMs`]: lastRun.computeMs,
                [`${lastRun.prefix}CommitMs`]: diagnostics.phases.commitMs,
                [`${lastRun.prefix}DispatchMs`]: diagnostics.phases.dispatchMs,
                [`${lastRun.prefix}FlushMs`]: lastRun.schedulerFlushMs,
                [`${lastRun.prefix}SetDataCalls`]: counter.total - lastRun.startCalls,
              }
            : {}),
        },
        totalSetDataCalls: counter.total,
        strategyLabel: options.strategyLabel,
        measurement: lastRun ? { version: 2, ...lastRun, phases: diagnostics.phases } : null,
        setDataDiagnostics: lastRun ? { [lastRun.prefix]: diagnostics } : {},
      }
    }

    async function runWorkloadBench(workload: Workload = 'replace', rounds = 1) {
      if (!['replace', 'frequent', 'small-field', 'batch', 'append', 'reorder'].includes(workload)) {
        throw new Error(`Unknown workload: ${workload}`)
      }
      await nextTick()
      resetSetDataDiagnosticsTracker(options.tracker)
      const startedAt = now()
      lastRun = {
        workload,
        prefix: workload === 'frequent' ? 'microCommit' : 'singleCommit',
        computeMs: 0,
        assignmentMs: 0,
        schedulerFlushMs: 0,
        elapsedMs: 0,
        startCalls: counter.total,
      }
      const count = Math.max(1, Math.floor(Number(rounds) || 1))
      const iterations = workload === 'frequent' ? count : 1
      for (let index = 0; index < iterations; index++) {
        const computeStartedAt = now()
        let cards = state.cards
        if (workload === 'replace' || workload === 'frequent') {
          const mutations = workload === 'replace' ? count : 1
          for (let step = 0; step < mutations; step++) {
            cards = mutateBenchCards(cards, index + step + 1)
          }
        }
        lastRun.computeMs += now() - computeStartedAt
        const assignmentStartedAt = now()
        if (workload === 'small-field') {
          state.cards[0].score += 1
        }
        else if (workload === 'batch') {
          for (let card = 0; card < 20; card++) {
            state.cards[card].score += 1
          }
        }
        else if (workload === 'append') {
          state.cards.push(...createBenchCards(23, 10))
        }
        else if (workload === 'reorder') {
          state.cards.reverse()
        }
        else {
          state.cards = cards
        }
        state.summary = `${summarizeBenchCards(state.cards)} first=${state.cards[0].id}`
        lastRun.assignmentMs += now() - assignmentStartedAt
        const schedulerStartedAt = now()
        await nextTick()
        lastRun.schedulerFlushMs += now() - schedulerStartedAt
      }
      lastRun.elapsedMs = now() - startedAt
      return readBenchState()
    }

    return {
      readBenchState,
      readUpdateBenchObservation: readBenchState,
      runWorkloadBench,
      runSingleCommitBench: (rounds = 180) => runWorkloadBench('replace', rounds),
      runMicroCommitBench: (rounds = 40) => runWorkloadBench('frequent', rounds),
    }
  }
}

export function createUpdateBenchTracker() {
  return createSetDataDiagnosticsTracker()
}
