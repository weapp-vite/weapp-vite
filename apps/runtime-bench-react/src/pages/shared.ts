import type { ReactMiniProgramRoot } from '@weapp-vite/react'
import type { RefObject } from 'react'
import type { BenchMetrics, SetDataCounter } from '../utils/bench'

export interface BenchSnapshot {
  readyMarker: string
  cardCount: number
  summary: string
  metrics: BenchMetrics
  totalSetDataCalls: number
}

export interface BenchPageController {
  finishReady: (loadToReadyMs: number, firstCommitMs: number) => void
  readBenchState: () => BenchSnapshot
}

export interface UpdateBenchPageController extends BenchPageController {
  runMicroCommitBench: (rounds?: number) => Promise<BenchSnapshot>
  runSingleCommitBench: (rounds?: number) => Promise<BenchSnapshot>
}

export interface ReactBenchPageRuntime<T extends BenchPageController> {
  controller: RefObject<T | null>
  loadStartedAt: number
  root: ReactMiniProgramRoot
  setDataCounter: SetDataCounter
}

export function readFirstCommitMs(counter: SetDataCounter, loadStartedAt: number) {
  return counter.firstCommitAt === null ? 0 : counter.firstCommitAt - loadStartedAt
}
