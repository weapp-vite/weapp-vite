import type { RecoverableSession } from '../runtimeBench'
import type { BenchUpdateSample, BenchUpdateSummary } from './types'
import process from 'node:process'
import { readBenchHostHeap } from './heap'
import { median, observedNumber } from './metrics'

async function settleObservation(page: any, state: any, startedAt: number) {
  const deadline = startedAt + 30_000
  while (Date.now() < deadline) {
    state = await page.callMethod('readUpdateBenchObservation')
    const phases = state?.measurement?.phases
    if (phases?.failed) {
      throw new Error(`Benchmark revision failed: ${JSON.stringify(phases.events)}`)
    }
    if (phases?.revisions > 0 && phases.pending === 0) {
      return state
    }
    await page.waitFor(25)
  }
  throw new Error('Benchmark revisions did not settle within 30000ms')
}

async function observeVisibleState(page: any, state: any, startedAt: number) {
  const deadline = startedAt + 30_000
  while (Date.now() < deadline) {
    const marker = await page.$('#bench-visible-marker')
    const text = marker ? await marker.text() : ''
    const cards = await page.$$('.card')
    const firstTitle = await page.$('.card__title')
    const title = firstTitle ? await firstTitle.text() : ''
    if (text.includes(state.summary) && cards.length === state.cardCount && title === state.firstCardTitle) {
      return { elapsedMs: Date.now() - startedAt, summary: state.summary as string, cardCount: cards.length as number, firstCardTitle: title as string }
    }
    await page.waitFor(25)
  }
  throw new Error('Benchmark rendered summary/card count/order did not match the final input')
}

export async function measureUpdate(options: {
  session: RecoverableSession<any>
  route: string
  method: 'runSingleCommitBench' | 'runMicroCommitBench'
  rounds: number
  sampleCount: number
  requirePhases: boolean
  provider: string
  workload?: string
  log: (message: string) => void
}): Promise<BenchUpdateSummary> {
  const samples: BenchUpdateSample[] = []
  const prefix = options.method === 'runSingleCommitBench' ? 'singleCommit' : 'microCommit'
  // 每个场景先预热一次；保留后续所有原始样本，不挑选最快值。
  for (let index = -1; index < options.sampleCount; index++) {
    const label = `${options.workload ?? options.method} route=${options.route} sample=${index < 0 ? 'warmup' : index + 1}`
    options.log(label)
    const sample = await options.session.run(label, async (miniProgram) => {
      const page = await miniProgram.reLaunch(options.route)
      await page.waitFor('#bench-ready-marker')
      await page.waitFor(100)
      const hostHeapBefore = await readBenchHostHeap(miniProgram, options.provider)
      const workerRssBefore = process.memoryUsage().rss
      const startedAt = Date.now()
      let state = options.workload
        ? await page.callMethod('runWorkloadBench', options.workload, options.rounds)
        : await page.callMethod(options.method, options.rounds)
      if (options.requirePhases) {
        state = await settleObservation(page, state, startedAt)
      }
      const visible = options.requirePhases ? await observeVisibleState(page, state, startedAt) : undefined
      const wallMs = Date.now() - startedAt
      const workerRssAfter = process.memoryUsage().rss
      const hostHeapAfter = await readBenchHostHeap(miniProgram, options.provider)
      const diagnostics = state?.setDataDiagnostics?.[prefix] ?? {}
      const phases = options.requirePhases ? state.measurement.phases : undefined
      return {
        wallMs,
        metricMs: observedNumber(state?.metrics?.[`${prefix}Ms`]),
        computeMs: observedNumber(state?.metrics?.[`${prefix}ComputeMs`]),
        commitMs: observedNumber(phases?.commitMs),
        dispatchMs: observedNumber(phases?.dispatchMs),
        flushMs: observedNumber(state?.metrics?.[`${prefix}FlushMs`]),
        setDataCalls: observedNumber(state?.metrics?.[`${prefix}SetDataCalls`]),
        setDataDiagnostics: {
          flushes: observedNumber(diagnostics.flushes),
          patchFlushes: observedNumber(diagnostics.patchFlushes),
          diffFlushes: observedNumber(diagnostics.diffFlushes),
          fallbackFlushes: observedNumber(diagnostics.fallbackFlushes),
          avgPayloadKeys: observedNumber(diagnostics.avgPayloadKeys),
          maxPayloadKeys: observedNumber(diagnostics.maxPayloadKeys),
          avgPendingPatchKeys: observedNumber(diagnostics.avgPendingPatchKeys),
          maxPendingPatchKeys: observedNumber(diagnostics.maxPendingPatchKeys),
          avgBytes: observedNumber(diagnostics.avgBytes),
          maxBytes: observedNumber(diagnostics.maxBytes),
          fallbackReasons: diagnostics.fallbackReasons as Record<string, number> | undefined,
        },
        phases,
        visible,
        memory: {
          workerRssBefore,
          workerRssAfter,
          hostHeapBytes: hostHeapAfter.usage.status === 'available' ? hostHeapAfter.usage.usedSize : null,
          hostHeapCapability: hostHeapAfter.usage.status === 'available' ? 'available' as const : 'unavailable' as const,
          hostHeapBefore,
          hostHeapAfter,
        },
      }
    })
    if (index >= 0) {
      samples.push(sample)
    }
  }
  const fallbackReasons: Record<string, number> = {}
  for (const sample of samples) {
    for (const [reason, count] of Object.entries(sample.setDataDiagnostics.fallbackReasons ?? {})) {
      fallbackReasons[reason] = Math.max(fallbackReasons[reason] ?? 0, count)
    }
  }
  return {
    wallMsMedian: median(samples.map(sample => sample.wallMs)),
    metricMsMedian: median(samples.map(sample => sample.metricMs)),
    computeMsMedian: median(samples.map(sample => sample.computeMs)),
    commitMsMedian: median(samples.map(sample => sample.commitMs)),
    dispatchMsMedian: median(samples.map(sample => sample.dispatchMs)),
    flushMsMedian: median(samples.map(sample => sample.flushMs)),
    setDataCallsMedian: median(samples.map(sample => sample.setDataCalls)),
    setDataDiagnosticsMedian: {
      flushes: median(samples.map(sample => sample.setDataDiagnostics.flushes)),
      patchFlushes: median(samples.map(sample => sample.setDataDiagnostics.patchFlushes)),
      diffFlushes: median(samples.map(sample => sample.setDataDiagnostics.diffFlushes)),
      fallbackFlushes: median(samples.map(sample => sample.setDataDiagnostics.fallbackFlushes)),
      avgPayloadKeys: median(samples.map(sample => sample.setDataDiagnostics.avgPayloadKeys)),
      maxPayloadKeys: median(samples.map(sample => sample.setDataDiagnostics.maxPayloadKeys)),
      avgPendingPatchKeys: median(samples.map(sample => sample.setDataDiagnostics.avgPendingPatchKeys)),
      maxPendingPatchKeys: median(samples.map(sample => sample.setDataDiagnostics.maxPendingPatchKeys)),
      avgBytes: median(samples.map(sample => sample.setDataDiagnostics.avgBytes)),
      maxBytes: median(samples.map(sample => sample.setDataDiagnostics.maxBytes)),
    },
    fallbackReasons,
    samples,
  }
}
