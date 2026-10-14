import type { Cell, Collection, Measurement, ProfileCase } from './types'
import { describe, expect, it } from 'vitest'
import { compilerCases } from './cases'
import { collectCompilerTrials, createSchedule } from './collection'
import { createCounters } from './diagnostics'

const fixture: ProfileCase = { id: 'target', cohort: 'wevu', project: 'app', config: 'vite.config.ts', file: 'src/index.vue', isPage: true, expectCompilerBatch: true }

function sample(cell: Cell): Measurement {
  const counters = cell.metric === 'diagnostic' ? createCounters() : null
  if (counters && cell.arm === 'on') {
    counters.compilerBatchCalls = 1
    counters.compilerBatchInputs = 2
    counters.compilerBatchUniqueInputs = 1
  }
  return {
    cell,
    outcome: { status: 'success', result: { script: 'Page({})', scriptMap: { mappings: 'AAAA', sourcesContent: ['source'] } }, warnings: [] },
    compileMs: cell.arm === 'off' ? 12 : 10,
    addonLoadMs: cell.arm === 'off' ? 0 : 2,
    importMs: 1,
    preparationMs: 1,
    rssBefore: 100,
    rssAfter: 110,
    peakRssBytes: 120,
    warmupCount: cell.condition === 'warm' ? 2 : 0,
    counters,
    cpu: counters ? { user: 1, system: 0 } : null,
    gc: counters ? { count: 0, durationMs: 0 } : null,
    sampledAllocationBytes: counters ? 10 : null,
    identity: { compilerSha256: 'compiler', addonSha256: cell.arm === 'on' ? 'addon' : null, sourceSha256: 'source' },
  }
}

describe('real compiler paired collection', () => {
  it('plans 2560 wall samples and a separate 64 diagnostic samples for eight real fixtures', () => {
    const schedule = createSchedule(compilerCases, 40, true)
    expect(schedule.filter(cell => cell.metric === 'wall')).toHaveLength(2560)
    expect(schedule.filter(cell => cell.metric === 'diagnostic')).toHaveLength(64)
    expect(schedule.slice(0, 2).map(cell => cell.arm)).toEqual(['off', 'on'])
    expect(schedule.slice(64, 66).map(cell => cell.arm)).toEqual(['on', 'off'])
    expect(schedule.slice(2560).every(cell => cell.metric === 'diagnostic')).toBe(true)
    for (const fixture of compilerCases) {
      for (const condition of ['cold', 'warm']) {
        for (const sourceMap of [false, true]) {
          for (const arm of ['off', 'on']) {
            expect(schedule.filter(cell => cell.metric === 'wall' && cell.caseId === fixture.id && cell.condition === condition && cell.sourceMap === sourceMap && cell.arm === arm)).toHaveLength(40)
          }
        }
      }
    }
  })

  it('rejects fewer than 40 pairs', () => {
    expect(() => createSchedule([fixture], 39, false)).toThrow('40')
    expect(() => createSchedule([fixture], Number.NaN, false)).toThrow('40')
  })

  it('checkpoints every sample and only passes a complete strict-parity collection', async () => {
    const snapshots: number[] = []
    const result = await collectCompilerTrials([fixture], 40, true, async cell => sample(cell), async (state) => {
      snapshots.push(state.samples.length)
    })
    expect(result.status).toBe('passed')
    expect(result.samples).toHaveLength(328)
    expect(snapshots).toContain(1)
    expect(snapshots.at(-1)).toBe(328)
  })

  it.each(['worker', 'map', 'identity', 'wrong-cell', 'native-missing', 'instrumented-wall'])('preserves completed samples and the original %s failure', async (failure) => {
    let saved: Collection | undefined
    let calls = 0
    const collect = async (cell: Cell) => {
      const result = sample(cell)
      if (++calls !== 2) {
        return result
      }
      if (failure === 'worker') {
        throw new Error('worker stopped')
      }
      if (failure === 'map') {
        result.outcome = { status: 'success', result: { script: 'Page({})', scriptMap: { mappings: 'AAAB', sourcesContent: ['source'] } }, warnings: [] }
      }
      if (failure === 'identity') {
        result.identity.compilerSha256 = 'changed'
      }
      if (failure === 'wrong-cell') {
        result.cell = { ...cell, trial: 99 }
      }
      if (failure === 'native-missing') {
        result.identity.addonSha256 = null
      }
      if (failure === 'instrumented-wall') {
        result.counters = createCounters()
      }
      return result
    }
    await expect(collectCompilerTrials([fixture], 40, true, collect, async (state) => {
      saved = state
    })).rejects.toThrow()
    expect(saved?.status).toBe('failed')
    expect(saved?.samples).toHaveLength(failure === 'worker' ? 1 : 2)
    expect(saved?.failedCell?.arm).toBe('on')
    expect(saved?.errors).toHaveLength(1)
  })

  it('rejects native samples that never consume the expected batch', async () => {
    let saved: Collection | undefined
    await expect(collectCompilerTrials([fixture], 40, true, async (cell) => {
      const result = sample(cell)
      if (result.counters) {
        result.counters.compilerBatchCalls = 0
      }
      return result
    }, async (state) => {
      saved = state
    })).rejects.toThrow('batch acceptance')
    expect(saved?.status).toBe('failed')
    expect(saved?.samples.filter(item => item.cell.metric === 'wall')).toHaveLength(320)
  })
})
