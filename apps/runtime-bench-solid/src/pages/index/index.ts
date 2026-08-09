import type { SolidBenchRuntime } from '../shared'
import { createMemo, createRoot, createSignal } from 'solid-js/dist/solid.js'
import { createSolidMiniProgramRoot } from '../../runtime'
import {
  createBenchCards,
  createEmptyMetrics,
  INDEX_CARD_COUNT,
  navigateTo,
  now,
  patchSetData,
  summarizeBenchCards,
} from '../../utils/bench'
import { snapshot } from '../shared'

const runtimes = new WeakMap<object, SolidBenchRuntime>()

Page({
  data: {},
  onLoad() {
    const loadStartedAt = now()
    const setDataCounter = { total: 0, firstCommitAt: null }
    patchSetData(this, setDataCounter)
    const root = createSolidMiniProgramRoot(this)
    const runtime = createRoot((dispose) => {
      const [cards, setCards] = createSignal(createBenchCards(1, INDEX_CARD_COUNT))
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
    runtime.metrics.loadToReadyMs = -loadStartedAt
    runtimes.set(this, runtime)
  },
  onReady() {
    const runtime = runtimes.get(this)
    if (!runtime) {
      return
    }
    const loadStartedAt = -runtime.metrics.loadToReadyMs
    runtime.metrics.loadToReadyMs = now() - loadStartedAt
    runtime.metrics.firstCommitMs = runtime.setDataCounter.firstCommitAt === null
      ? 0
      : runtime.setDataCounter.firstCommitAt - loadStartedAt
  },
  onUnload() {
    const runtime = runtimes.get(this)
    runtime?.root.dispose()
    runtime?.dispose()
    runtimes.delete(this)
  },
  readBenchState() {
    const runtime = runtimes.get(this)
    return runtime ? snapshot(runtime, 'solid-index-ready') : undefined
  },
  async navigateToDetail() {
    await navigateTo('/pages/detail/index')
    return true
  },
})
