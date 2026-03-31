import {
  createBenchCards,
  createEmptyMetrics,
  mutateBenchCards,
  now,
  patchSetData,
  summarizeBenchCards,
  UPDATE_CARD_COUNT,
  waitForNativeFlush,
  type BenchMetrics,
  type SetDataCounter,
} from '../../utils/bench'

const setDataCounter: SetDataCounter = {
  total: 0,
  firstCommitAt: null,
}

let loadStartedAt = 0

function buildSnapshot(data: {
  cards: unknown[]
  metrics: BenchMetrics
  readyMarker: string
  summary: string
}) {
  return {
    readyMarker: data.readyMarker,
    cardCount: data.cards.length,
    summary: data.summary,
    metrics: data.metrics,
    totalSetDataCalls: setDataCounter.total,
  }
}

Page({
  data: {
    title: 'Native Update Benchmark',
    readyMarker: '',
    summary: '',
    cards: [],
    metrics: createEmptyMetrics(),
  },

  onLoad() {
    loadStartedAt = now()
    setDataCounter.total = 0
    setDataCounter.firstCommitAt = null
    patchSetData(this, setDataCounter)

    const cards = createBenchCards(11, UPDATE_CARD_COUNT)
    this.setData({
      readyMarker: 'native-update-ready',
      summary: summarizeBenchCards(cards),
      cards,
    })
  },

  onReady() {
    this.setData({
      metrics: {
        ...this.data.metrics,
        loadToReadyMs: now() - loadStartedAt,
        firstCommitMs: setDataCounter.firstCommitAt ? setDataCounter.firstCommitAt - loadStartedAt : 0,
      },
    })
  },

  readBenchState() {
    return buildSnapshot(this.data)
  },

  async runSingleCommitBench(rounds = 180) {
    const startCalls = setDataCounter.total
    const startAt = now()
    let cards = this.data.cards
    const computeStartedAt = now()

    for (let index = 0; index < rounds; index += 1) {
      cards = mutateBenchCards(cards, index + 1)
    }
    const computeMs = now() - computeStartedAt

    const dispatchStartedAt = now()
    this.setData({
      cards,
      summary: summarizeBenchCards(cards),
    })
    const dispatchMs = now() - dispatchStartedAt

    const flushStartedAt = now()
    await waitForNativeFlush()
    const flushMs = now() - flushStartedAt
    const commitMs = dispatchMs + flushMs

    const durationMs = now() - startAt
    const metrics = {
      ...this.data.metrics,
      singleCommitMs: durationMs,
      singleCommitComputeMs: computeMs,
      singleCommitCommitMs: commitMs,
      singleCommitDispatchMs: dispatchMs,
      singleCommitFlushMs: flushMs,
      singleCommitSetDataCalls: setDataCounter.total - startCalls,
    }

    this.setData({
      metrics,
    })

    return buildSnapshot({
      ...this.data,
      cards,
      summary: summarizeBenchCards(cards),
      metrics,
    })
  },

  async runMicroCommitBench(rounds = 40) {
    const startCalls = setDataCounter.total
    const startAt = now()
    let cards = this.data.cards
    let computeMs = 0
    let commitMs = 0
    let dispatchMs = 0
    let flushMs = 0

    for (let index = 0; index < rounds; index += 1) {
      const computeStartedAt = now()
      cards = mutateBenchCards(cards, index + 1)
      computeMs += now() - computeStartedAt

      const dispatchStartedAt = now()
      this.setData({
        cards,
        summary: summarizeBenchCards(cards),
      })
      dispatchMs += now() - dispatchStartedAt

      const flushStartedAt = now()
      await waitForNativeFlush()
      flushMs += now() - flushStartedAt
    }
    commitMs = dispatchMs + flushMs

    const durationMs = now() - startAt
    const metrics = {
      ...this.data.metrics,
      microCommitMs: durationMs,
      microCommitComputeMs: computeMs,
      microCommitCommitMs: commitMs,
      microCommitDispatchMs: dispatchMs,
      microCommitFlushMs: flushMs,
      microCommitSetDataCalls: setDataCounter.total - startCalls,
    }

    this.setData({
      metrics,
    })

    return buildSnapshot({
      ...this.data,
      cards,
      summary: summarizeBenchCards(cards),
      metrics,
    })
  },
})
