import { afterEach, describe, expect, it, vi } from 'vitest'
import { runWatcherScenario } from '../../../scripts/watcherComparison/harness'
import { watcherScenarios } from '../../../scripts/watcherComparison/scenarios'
import { resolveFileWatchEngine } from './fileWatcher'

afterEach(() => vi.unstubAllEnvs())
let unconfirmedCleanup: string | undefined

describe('file watcher engine selection', () => {
  it('keeps an explicit project choice ahead of the environment override', () => {
    vi.stubEnv('WEAPP_VITE_WATCH_ENGINE', 'parcel')
    expect(resolveFileWatchEngine({ inlineConfig: { weapp: { watch: { engine: 'chokidar' } } } })).toBe('chokidar')
  })

  it('uses the environment override when the project does not choose an engine', () => {
    vi.stubEnv('WEAPP_VITE_WATCH_ENGINE', 'parcel')
    expect(resolveFileWatchEngine({ inlineConfig: {} })).toBe('parcel')
  })

  it('reports an unsupported override instead of silently selecting another engine', () => {
    vi.stubEnv('WEAPP_VITE_WATCH_ENGINE', 'unsupported')
    expect(() => resolveFileWatchEngine({ inlineConfig: {} })).toThrow('Unknown weapp.watch.engine')
  })
})

describe.each(['chokidar', 'parcel'] as const)('%s filesystem contract', (engine) => {
  it.each(watcherScenarios)('$id', async (scenario) => {
    if (unconfirmedCleanup) {
      throw new Error(`Earlier watcher cleanup is unconfirmed: ${unconfirmedCleanup}`)
    }
    const report = await runWatcherScenario(engine, scenario)
    if (!report.cleanupConfirmed) {
      unconfirmedCleanup = `${report.engine}/${report.scenario}/${report.retainedFixture ?? 'unknown-fixture'}`
    }
    expect(report.failures, JSON.stringify(report, null, 2)).toEqual([])
    expect(report.status).toBe('passed')
    expect(report.cleanupConfirmed).toBe(true)
    expect(report.steps.every(step => step.stateVerified)).toBe(true)
    expect(report.steps.reduce((count, step) => count + step.missing, 0)).toBe(0)
    expect(report.startupMs.length).toBeGreaterThan(0)
    expect(report.closeMs.length).toBe(report.startupMs.length)
  }, 30_000)
})
