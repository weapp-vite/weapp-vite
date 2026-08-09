import type { ReactMiniProgramRoot } from '@weapp-vite/react'
import type { BenchMetrics, SetDataCounter } from '../../utils/bench'
import { createReactMiniProgramRoot } from '@weapp-vite/react'
import { createElement } from 'react'
import { createEmptyMetrics, now, patchSetData } from '../../utils/bench'
import { ReactStaticUpdatePage } from './view'

interface StaticRuntime {
  metrics: BenchMetrics
  root: ReactMiniProgramRoot
  setDataCounter: SetDataCounter
  value: number
}

const runtimes = new WeakMap<object, StaticRuntime>()

function snapshot(runtime: StaticRuntime) {
  return {
    readyMarker: 'react-static-update-ready',
    cardCount: 0,
    summary: `value=${runtime.value}`,
    metrics: runtime.metrics,
    totalSetDataCalls: runtime.setDataCounter.total,
  }
}

function render(runtime: StaticRuntime) {
  runtime.root.render(createElement(ReactStaticUpdatePage, {
    metrics: runtime.metrics,
    value: runtime.value,
  }))
}

async function waitForNativeCommit() {
  await new Promise<void>(resolve => wx.nextTick(resolve))
}

Page({
  data: { slots: {} },
  eh(event: WechatMiniprogram.BaseEvent) {
    runtimes.get(this)?.root.dispatchEvent(event)
  },
  onLoad() {
    const setDataCounter = { total: 0, firstCommitAt: null }
    patchSetData(this, setDataCounter)
    const runtime: StaticRuntime = {
      metrics: createEmptyMetrics(),
      root: createReactMiniProgramRoot(this, { renderMode: 'static-bindings' }),
      setDataCounter,
      value: 0,
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
    const computeStartedAt = now()
    for (let index = 0; index < rounds; index += 1) {
      runtime.value = (runtime.value + index + 1) % 100000
    }
    const computeMs = now() - computeStartedAt
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
      runtime.value = (runtime.value + index + 1) % 100000
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
