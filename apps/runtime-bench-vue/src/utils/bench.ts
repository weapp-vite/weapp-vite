export interface BenchCard {
  id: string
  title: string
  summary: string
  score: number
  delta: number
  active: boolean
  tags: string[]
}

export interface BenchMetrics {
  loadToReadyMs: number
  firstCommitMs: number
  singleCommitMs: number
  singleCommitComputeMs: number
  singleCommitCommitMs: number
  singleCommitDispatchMs: number
  singleCommitFlushMs: number
  singleCommitSetDataCalls: number
  microCommitMs: number
  microCommitComputeMs: number
  microCommitCommitMs: number
  microCommitDispatchMs: number
  microCommitFlushMs: number
  microCommitSetDataCalls: number
}

export interface SetDataCounter {
  total: number
  firstCommitAt: number | null
}

export const INDEX_CARD_COUNT = 120
export const DETAIL_CARD_COUNT = 180
export const UPDATE_CARD_COUNT = 100

export function now() {
  return Date.now()
}

export function createBenchCards(seed: number, count: number): BenchCard[] {
  return Array.from({ length: count }, (_, index) => {
    const rank = seed * 13 + index * 7
    return {
      id: `card-${seed}-${index}`,
      title: `Benchmark Card ${index + 1}`,
      summary: `seed=${seed} rank=${rank % 97} lane=${index % 5}`,
      score: (rank * 17) % 1000,
      delta: (rank % 19) - 9,
      active: (index + seed) % 4 === 0,
      tags: [
        `lane-${index % 5}`,
        `seed-${seed % 7}`,
        (index + seed) % 2 === 0 ? 'hot' : 'warm',
      ],
    }
  })
}

export function mutateBenchCards(cards: BenchCard[], step: number): BenchCard[] {
  return cards.map((card, index) => {
    const nextScore = (card.score + step + index * 3) % 1000
    const nextDelta = ((card.delta + step + index) % 21) - 10
    const nextActive = (index + step) % 5 === 0
    return {
      ...card,
      score: nextScore,
      delta: nextDelta,
      active: nextActive,
      summary: `step=${step} rank=${(nextScore + nextDelta + index) % 113} lane=${index % 5}`,
      tags: [
        `lane-${index % 5}`,
        `step-${step % 9}`,
        nextActive ? 'hot' : 'warm',
      ],
    }
  })
}

export function summarizeBenchCards(cards: BenchCard[]) {
  const activeCount = cards.filter(card => card.active).length
  const checksum = cards.reduce((total, card) => total + card.score + card.delta, 0)
  return `cards=${cards.length} active=${activeCount} checksum=${checksum}`
}

export function createEmptyMetrics(): BenchMetrics {
  return {
    loadToReadyMs: 0,
    firstCommitMs: 0,
    singleCommitMs: 0,
    singleCommitComputeMs: 0,
    singleCommitCommitMs: 0,
    singleCommitDispatchMs: 0,
    singleCommitFlushMs: 0,
    singleCommitSetDataCalls: 0,
    microCommitMs: 0,
    microCommitComputeMs: 0,
    microCommitCommitMs: 0,
    microCommitDispatchMs: 0,
    microCommitFlushMs: 0,
    microCommitSetDataCalls: 0,
  }
}

export function patchSetData(instance: any, counter: SetDataCounter) {
  if (!instance || typeof instance.setData !== 'function' || instance.__benchPatchedSetData) {
    return
  }
  const rawSetData = instance.setData.bind(instance)
  instance.__benchPatchedSetData = true
  instance.setData = (payload: Record<string, any>, callback?: () => void) => {
    counter.total += 1
    if (counter.firstCommitAt === null) {
      counter.firstCommitAt = now()
    }
    return rawSetData(payload, callback)
  }
}
