import {
  createBenchCards,
  createEmptyMetrics,
  DETAIL_CARD_COUNT,
  now,
  patchSetData,
  summarizeBenchCards,
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
    title: 'Native Detail Navigation Target',
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

    const cards = createBenchCards(7, DETAIL_CARD_COUNT)
    this.setData({
      readyMarker: 'native-detail-ready',
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
})
