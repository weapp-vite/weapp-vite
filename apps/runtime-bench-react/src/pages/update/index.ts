import type { ReactMiniProgramRoot } from '@weapp-vite/react'
import type { BenchCard, BenchMetrics, SetDataCounter } from '../../utils/bench'
import { createReactMiniProgramRoot } from '@weapp-vite/react'
import { createElement } from 'react'
import {
  createBenchCards,
  createEmptyMetrics,
  mutateBenchCards,
  now,
  patchSetData,
  summarizeBenchCards,
  UPDATE_CARD_COUNT,
} from '../../utils/bench'
import { ReactUpdatePage } from './view'

interface UpdateRuntime {
  cards: BenchCard[]
  metrics: BenchMetrics
  root: ReactMiniProgramRoot
  setDataCounter: SetDataCounter
}

const runtimes = new WeakMap<object, UpdateRuntime>()

function snapshot(runtime: UpdateRuntime) {
  return {
    readyMarker: 'react-update-ready',
    cardCount: runtime.cards.length,
    summary: summarizeBenchCards(runtime.cards),
    metrics: runtime.metrics,
    totalSetDataCalls: runtime.setDataCounter.total,
  }
}

function render(runtime: UpdateRuntime) {
  runtime.root.render(createElement(ReactUpdatePage, {
    cards: runtime.cards,
    metrics: runtime.metrics,
  }))
}

async function waitForNativeCommit() {
  await new Promise<void>(resolve => wx.nextTick(resolve))
}

Page({
  data: { root: { cn: [] } },
  eh(event: WechatMiniprogram.BaseEvent) {
    runtimes.get(this)?.root.dispatchEvent(event)
  },
  onLoad() {
    const setDataCounter = { total: 0, firstCommitAt: null }
    patchSetData(this, setDataCounter)
    const runtime: UpdateRuntime = {
      cards: createBenchCards(11, UPDATE_CARD_COUNT),
      metrics: createEmptyMetrics(),
      root: createReactMiniProgramRoot(this),
      setDataCounter,
    }
    runtimes.set(this, runtime)
    render(runtime)
  },
  onUnload() {
    runtimes.get(this)?.root.unmount()
    runtimes.delete(this)
  },
  readBenchState() {
    const runtime = runtimes.get(this)
    return runtime ? snapshot(runtime) : undefined
  },
  async runSingleCommitBench(rounds = 180) {
    const runtime = runtimes.get(this)
    if (!runtime) {
      return undefined
    }
    const startCalls = runtime.setDataCounter.total
    const startAt = now()
    let cards = runtime.cards
    const computeStartedAt = now()
    for (let index = 0; index < rounds; index += 1) {
      cards = mutateBenchCards(cards, index + 1)
    }
    const computeMs = now() - computeStartedAt

    runtime.cards = cards
    const dispatchStartedAt = now()
    render(runtime)
    const dispatchMs = now() - dispatchStartedAt
    const flushStartedAt = now()
    await waitForNativeCommit()
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
    return snapshot(runtime)
  },
  async runMicroCommitBench(rounds = 40) {
    const runtime = runtimes.get(this)
    if (!runtime) {
      return undefined
    }
    const startCalls = runtime.setDataCounter.total
    const startAt = now()
    let computeMs = 0
    let dispatchMs = 0
    let flushMs = 0

    for (let index = 0; index < rounds; index += 1) {
      const computeStartedAt = now()
      runtime.cards = mutateBenchCards(runtime.cards, index + 1)
      computeMs += now() - computeStartedAt
      const dispatchStartedAt = now()
      render(runtime)
      dispatchMs += now() - dispatchStartedAt
      const flushStartedAt = now()
      await waitForNativeCommit()
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
    return snapshot(runtime)
  },
})
