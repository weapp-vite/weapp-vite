import type { Accessor, Setter } from 'solid-js'
import type { SolidMiniProgramRoot } from '../runtime'
import type { BenchCard, BenchMetrics, SetDataCounter } from '../utils/bench'

export interface SolidBenchRuntime {
  cards: Accessor<BenchCard[]>
  dispose: () => void
  metrics: BenchMetrics
  root: SolidMiniProgramRoot
  setCards: Setter<BenchCard[]>
  setDataCounter: SetDataCounter
}

export function snapshot(runtime: SolidBenchRuntime, readyMarker: string) {
  const cards = runtime.cards()
  return {
    readyMarker,
    cardCount: cards.length,
    summary: `cards=${cards.length}`,
    metrics: runtime.metrics,
    totalSetDataCalls: runtime.setDataCounter.total,
  }
}
