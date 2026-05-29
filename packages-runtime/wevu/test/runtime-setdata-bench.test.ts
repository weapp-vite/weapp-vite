import type { CreateAppOptions, SetDataDebugInfo } from '@/index'
import { describe, expect, it } from 'vitest'
import { createApp, nextTick } from '@/index'

interface BenchSummary {
  instances: number
  setDataCalls: number
  payloadKeys: number
  payloadBytes: number
  debugEvents: SetDataDebugInfo[]
}

function createCard(seed: number, index: number) {
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
}

function createCards(seed: number, count: number) {
  return Array.from({ length: count }, (_, index) => createCard(seed, index))
}

function createBenchSummary(instances: number): BenchSummary {
  return {
    instances,
    setDataCalls: 0,
    payloadKeys: 0,
    payloadBytes: 0,
    debugEvents: [],
  }
}

function createBenchAdapter(summary: BenchSummary) {
  return {
    setData(payload: Record<string, unknown>) {
      summary.setDataCalls += 1
      summary.payloadKeys += Object.keys(payload).length
      summary.payloadBytes += JSON.stringify(payload).length
    },
  }
}

async function mountManyComponentLikeInstances(options: {
  instances: number
  setData?: CreateAppOptions<any, any, any>['setData']
}) {
  const summary = createBenchSummary(options.instances)
  const runtimes = Array.from({ length: options.instances }, (_, index) => {
    return createApp({
      data: () => ({
        card: createCard(1, index),
        selected: index % 3 === 0,
        localCount: index,
      }),
      computed: {
        titleText(this: any) {
          return `${this.card.title}:${this.card.score}`
        },
        statusText(this: any) {
          return this.selected ? 'selected' : 'normal'
        },
        classMap(this: any) {
          return {
            active: this.card.active,
            selected: this.selected,
          }
        },
      },
      setData: {
        ...(options.setData ?? {}),
        debugWhen: 'always',
        debug: info => summary.debugEvents.push(info),
      },
    }).mount(createBenchAdapter(summary))
  })
  await nextTick()
  for (const runtime of runtimes) {
    runtime.unmount()
  }
  return summary
}

async function mountSinglePageLikeInstance(options: {
  cardCount: number
  setData?: CreateAppOptions<any, any, any>['setData']
}) {
  const summary = createBenchSummary(1)
  const runtime = createApp({
    data: () => ({
      cards: createCards(1, options.cardCount),
      selectedIds: Array.from({ length: options.cardCount / 4 }, (_, index) => `card-1-${index * 4}`),
      filter: 'all',
    }),
    computed: {
      activeCards(this: any) {
        return this.cards.filter((card: any) => card.active)
      },
      visibleCards(this: any) {
        return this.filter === 'all'
          ? this.cards
          : this.cards.filter((card: any) => card.active)
      },
      summaryText(this: any) {
        return `cards=${this.cards.length};active=${this.activeCards.length}`
      },
    },
    setData: {
      ...(options.setData ?? {}),
      debugWhen: 'always',
      debug: info => summary.debugEvents.push(info),
    },
  }).mount(createBenchAdapter(summary))
  await nextTick()
  runtime.unmount()
  return summary
}

describe('runtime: setData bench baseline', () => {
  it('captures initial setData calls for many component instances versus one page instance', async () => {
    const componentSummary = await mountManyComponentLikeInstances({ instances: 120 })
    const pageSummary = await mountSinglePageLikeInstance({ cardCount: 120 })

    expect(componentSummary.setDataCalls).toBe(120)
    expect(pageSummary.setDataCalls).toBe(1)
    expect(componentSummary.payloadKeys).toBe(120 * 6)
    expect(pageSummary.payloadKeys).toBe(6)
    expect(componentSummary.debugEvents).toHaveLength(120)
    expect(pageSummary.debugEvents).toHaveLength(1)
  })

  it('keeps patch strategy from changing initial flush call count', async () => {
    const diffSummary = await mountManyComponentLikeInstances({ instances: 120 })
    const patchSummary = await mountManyComponentLikeInstances({
      instances: 120,
      setData: {
        strategy: 'patch',
        mergeSiblingThreshold: 2,
        elevateTopKeyThreshold: 12,
        computedCompare: 'shallow',
      },
    })

    expect(patchSummary.setDataCalls).toBe(diffSummary.setDataCalls)
    expect(patchSummary.debugEvents.every(info => info.mode === 'diff' && info.reason === 'needsFullSnapshot')).toBe(true)
  })

  it('shows pick and includeComputed reduce initial payload without reducing call count', async () => {
    const baseline = await mountManyComponentLikeInstances({ instances: 120 })
    const picked = await mountManyComponentLikeInstances({
      instances: 120,
      setData: {
        pick: ['card', 'selected'],
      },
    })
    const withoutComputed = await mountManyComponentLikeInstances({
      instances: 120,
      setData: {
        includeComputed: false,
      },
    })

    expect(picked.setDataCalls).toBe(baseline.setDataCalls)
    expect(withoutComputed.setDataCalls).toBe(baseline.setDataCalls)
    expect(picked.payloadKeys).toBe(120 * 2)
    expect(withoutComputed.payloadKeys).toBe(120 * 3)
    expect(picked.payloadBytes).toBeLessThan(baseline.payloadBytes)
    expect(withoutComputed.payloadBytes).toBeLessThan(baseline.payloadBytes)
  })
})
