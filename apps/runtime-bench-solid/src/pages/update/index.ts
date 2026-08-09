import type { SolidBenchRuntime } from '../shared'
import { createMemo, createRoot, createSignal } from 'solid-js/dist/solid.js'
import { createSolidMiniProgramRoot } from '../../runtime'
import {
  createBenchCards,
  createEmptyMetrics,
  mutateBenchCards,
  now,
  patchSetData,
  summarizeBenchCards,
  UPDATE_CARD_COUNT,
  waitForNativeFlush,
} from '../../utils/bench'
import { snapshot } from '../shared'

const runtimes = new WeakMap<object, SolidBenchRuntime>()

Page({
  data: {},
  onLoad() {
    const setDataCounter = { total: 0, firstCommitAt: null }
    patchSetData(this, setDataCounter)
    const root = createSolidMiniProgramRoot(this)
    const runtime = createRoot((dispose) => {
      const [cards, setCards] = createSignal(createBenchCards(11, UPDATE_CARD_COUNT))
      const summary = createMemo(() => summarizeBenchCards(cards()))
      root.mount({ cards, summary })
      return {
        cards,
        dispose,
        metrics: createEmptyMetrics(),
        root,
        setCards,
        setDataCounter,
      }
    })
    runtimes.set(this, runtime)
  },
  onUnload() {
    const runtime = runtimes.get(this)
    runtime?.root.dispose()
    runtime?.dispose()
    runtimes.delete(this)
  },
  readBenchState() {
    const runtime = runtimes.get(this)
    return runtime ? snapshot(runtime, 'solid-update-ready') : undefined
  },
  async runSingleCommitBench(rounds = 180) {
    const runtime = runtimes.get(this)
    if (!runtime) {
      return undefined
    }
    const startCalls = runtime.setDataCounter.total
    const startAt = now()
    let cards = runtime.cards()
    const computeStartedAt = now()
    for (let index = 0; index < rounds; index += 1) {
      cards = mutateBenchCards(cards, index + 1)
    }
    const computeMs = now() - computeStartedAt
    const dispatchStartedAt = now()
    runtime.setCards(cards)
    const dispatchMs = now() - dispatchStartedAt
    const flushStartedAt = now()
    await runtime.root.flush()
    await waitForNativeFlush()
    const flushMs = now() - flushStartedAt
    runtime.metrics = {
      ...runtime.metrics,
      singleCommitMs: now() - startAt,
      singleCommitComputeMs: computeMs,
      singleCommitCommitMs: dispatchMs + flushMs,
      singleCommitDispatchMs: dispatchMs,
      singleCommitFlushMs: flushMs,
      singleCommitSetDataCalls: runtime.setDataCounter.total - startCalls,
    }
    return snapshot(runtime, 'solid-update-ready')
  },
  async runMicroCommitBench(rounds = 40) {
    const runtime = runtimes.get(this)
    if (!runtime) {
      return undefined
    }
    const startCalls = runtime.setDataCounter.total
    const startAt = now()
    let cards = runtime.cards()
    let computeMs = 0
    let dispatchMs = 0
    let flushMs = 0
    for (let index = 0; index < rounds; index += 1) {
      const computeStartedAt = now()
      cards = mutateBenchCards(cards, index + 1)
      computeMs += now() - computeStartedAt
      const dispatchStartedAt = now()
      runtime.setCards(cards)
      dispatchMs += now() - dispatchStartedAt
      const flushStartedAt = now()
      await runtime.root.flush()
      await waitForNativeFlush()
      flushMs += now() - flushStartedAt
    }
    runtime.metrics = {
      ...runtime.metrics,
      microCommitMs: now() - startAt,
      microCommitComputeMs: computeMs,
      microCommitCommitMs: dispatchMs + flushMs,
      microCommitDispatchMs: dispatchMs,
      microCommitFlushMs: flushMs,
      microCommitSetDataCalls: runtime.setDataCounter.total - startCalls,
    }
    return snapshot(runtime, 'solid-update-ready')
  },
})
