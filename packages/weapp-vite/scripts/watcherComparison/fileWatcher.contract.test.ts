import { describe, expect, it } from 'vitest'
import { runWatcherScenario } from './harness'
import { watcherScenarios } from './scenarios'

let unconfirmedCleanup: string | undefined

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
