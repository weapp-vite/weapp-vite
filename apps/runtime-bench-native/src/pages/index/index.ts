import {
  createBenchCards,
  createEmptyMetrics,
  INDEX_CARD_COUNT,
  navigateTo,
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
    title: 'Native Runtime Baseline',
    subtitle: '首屏、切页、setData 与高频更新的原生基准页',
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

    const cards = createBenchCards(1, INDEX_CARD_COUNT)

    this.setData({
      readyMarker: 'native-index-ready',
      summary: summarizeBenchCards(cards),
      cards,
      metrics: createEmptyMetrics(),
    })
  },

  onReady() {
    const metrics = {
      ...this.data.metrics,
      loadToReadyMs: now() - loadStartedAt,
      firstCommitMs: setDataCounter.firstCommitAt ? setDataCounter.firstCommitAt - loadStartedAt : 0,
    }

    this.setData({
      metrics,
    })
  },

  readBenchState() {
    return buildSnapshot(this.data)
  },

  async navigateToDetail() {
    await navigateTo('/pages/detail/index')
    return true
  },

  async navigateToUpdate() {
    await navigateTo('/pages/update/index')
    return true
  },
})
