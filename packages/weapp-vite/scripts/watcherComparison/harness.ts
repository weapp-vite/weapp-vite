import type { FileWatchEngine, FileWatchOptions, FileWatchTargets } from './fileWatcher'
import type { WatcherObservation, WatcherSample, WatcherScenario, WatcherScenarioContext, WatcherScenarioReport } from './types'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { createFileWatcher } from './fileWatcher'
import { matchesWatcherChange, verifyWatcherStates } from './state'

const timeoutMs = 5000
const quietMs = 160

function sample(): WatcherSample {
  const diagnostics = process as typeof process & { _getActiveHandles?: () => unknown[] }
  const resourceTypes: Record<string, number> = {}
  for (const type of process.getActiveResourcesInfo()) {
    resourceTypes[type] = (resourceTypes[type] ?? 0) + 1
  }
  return {
    rssBytes: process.memoryUsage().rss,
    handles: diagnostics._getActiveHandles?.().length ?? 0,
    resourceTypes,
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function relativeFile(root: string, file: string) {
  return path.relative(root, file).replaceAll('\\', '/')
}

/** 同一套真实保存序列同时供契约测试和独立进程对照使用。 */
export async function runWatcherScenario(engine: FileWatchEngine, scenario: WatcherScenario, signal?: AbortSignal): Promise<WatcherScenarioReport> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'watcher-contract-')))
  const startedAt = performance.now()
  const cpu = process.cpuUsage()
  const before = sample()
  let peak = before
  const observations: WatcherObservation[] = []
  const startupTasks: Promise<unknown>[] = []
  const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))
    .replaceAll(root, '<fixture>')
    .replaceAll(path.resolve(import.meta.dirname, '../../../..'), '<repository>')
    .replaceAll(homedir(), '<home>')
  const report: WatcherScenarioReport = {
    scenario: scenario.id,
    engine,
    status: 'passed',
    durationMs: 0,
    startupMs: [],
    closeMs: [],
    cpuMs: { user: 0, system: 0 },
    resources: { before, peak, afterClose: before },
    steps: [],
    notifications: [],
    failures: [],
    cleanupConfirmed: false,
  }
  const updatePeak = () => {
    const current = sample()
    peak = {
      rssBytes: Math.max(peak.rssBytes, current.rssBytes),
      handles: Math.max(peak.handles, current.handles),
      resourceTypes: Object.fromEntries([...new Set([...Object.keys(peak.resourceTypes), ...Object.keys(current.resourceTypes)])]
        .map(type => [type, Math.max(peak.resourceTypes[type] ?? 0, current.resourceTypes[type] ?? 0)])),
    }
  }
  const sampler = setInterval(updatePeak, 20)
  sampler.unref()
  const cancel = () => {
    void Promise.allSettled(observations.map(observation => observation.close()))
  }
  signal?.addEventListener('abort', cancel, { once: true })
  const context: WatcherScenarioContext = {
    root,
    assert,
    observe(targets: FileWatchTargets, options: FileWatchOptions = {}) {
      assert(!signal?.aborted, 'Watcher comparison cancelled')
      const started = performance.now()
      const watcher = createFileWatcher(engine, targets, { persistent: true, ignoreInitial: true, ...options })
      const changes: WatcherObservation['changes'] = []
      watcher.onChange((batch) => {
        const receivedAtMs = performance.now() - startedAt
        changes.push(...batch.map(change => ({ ...change, receivedAtMs })))
        report.notifications.push(...batch.map(change => ({ ...change, file: relativeFile(root, change.file), receivedAtMs })))
        updatePeak()
      })
      watcher.onError((error) => {
        report.failures.push(errorText(error))
      })
      const ready = watcher.ready.then((result) => {
        report.startupMs.push(performance.now() - started)
        return result
      })
      startupTasks.push(ready)
      void ready.catch(() => {})
      let closing: Promise<void> | undefined
      const observation: WatcherObservation = {
        watcher,
        changes,
        close() {
          return closing ??= (async () => {
            const started = performance.now()
            try {
              await watcher.close()
            }
            finally {
              report.closeMs.push(performance.now() - started)
            }
          })()
        },
      }
      observations.push(observation)
      return observation
    },
    async expectChanges(name, observation, action, expected) {
      assert(!signal?.aborted, 'Watcher comparison cancelled')
      const offset = observation.changes.length
      const started = performance.now()
      await action()
      const matches = matchesWatcherChange
      const received = () => observation.changes.slice(offset)
      let states = await verifyWatcherStates(root, expected)
      while (!signal?.aborted && performance.now() - started < timeoutMs) {
        if (expected.every(wanted => received().some(change => matches(change, wanted)))) {
          states = await verifyWatcherStates(root, expected)
          if (states.every(state => state.verified)) {
            break
          }
        }
        await delay(10)
      }
      assert(!signal?.aborted, 'Watcher comparison cancelled')
      const observed = received().filter(change => change.receivedAtMs + startedAt - started <= timeoutMs)
      const latencies = expected.map(wanted => observed.find(change => matches(change, wanted)))
        .map(change => change ? change.receivedAtMs + startedAt - started : null)
      const missing = expected.filter(wanted => !observed.some(change => matches(change, wanted))).length
      const verifiedBeforeQuiet = states.every(state => state.verified)
      const verificationMs = !missing && verifiedBeforeQuiet ? performance.now() - started : null
      await delay(quietMs)
      const changes = received()
      const duplicate = expected.reduce((count, wanted) => count + Math.max(0, changes.filter(change => matches(change, wanted)).length - 1), 0)
      states = await verifyWatcherStates(root, expected)
      const stateVerified = verifiedBeforeQuiet && states.every(state => state.verified)
      report.steps.push({ name, latencyMs: latencies.includes(null) ? null : Math.max(0, ...latencies as number[]), verificationMs, missing, duplicate, notifications: changes.length, stateVerified, states })
      assert(missing === 0, `${name}: missing ${missing} expected notification(s)`)
      assert(stateVerified, `${name}: the final disk version or state differs from the requested operation`)
    },
    async expectQuiet(name, observation, action) {
      assert(!signal?.aborted, 'Watcher comparison cancelled')
      const offset = observation.changes.length
      await action()
      await delay(quietMs)
      const count = observation.changes.length - offset
      report.steps.push({ name, latencyMs: null, verificationMs: null, missing: 0, duplicate: count, notifications: count, stateVerified: true, states: [] })
      assert(count === 0, `${name}: received ${count} unexpected notification(s)`)
    },
  }
  try {
    await scenario.run(context)
  }
  catch (error) {
    report.status = 'failed'
    report.failures.push(errorText(error))
  }
  finally {
    signal?.removeEventListener('abort', cancel)
    const closed = await Promise.allSettled(observations.map(observation => observation.close()))
    report.cleanupConfirmed = closed.every(result => result.status === 'fulfilled')
    for (const result of closed) {
      if (result.status === 'rejected') {
        report.failures.push(errorText(result.reason))
      }
    }
    await Promise.allSettled(startupTasks)
    clearInterval(sampler)
    updatePeak()
    report.resources = { before, peak, afterClose: sample() }
    const consumed = process.cpuUsage(cpu)
    report.cpuMs = { user: consumed.user / 1000, system: consumed.system / 1000 }
    report.durationMs = performance.now() - startedAt
    if (report.cleanupConfirmed) {
      try {
        await rm(root, { recursive: true, force: true })
      }
      catch (error) {
        report.cleanupConfirmed = false
        report.failures.push(errorText(error))
      }
    }
    if (!report.cleanupConfirmed) {
      report.retainedFixture = path.basename(root)
    }
  }
  if (report.failures.length) {
    report.status = 'failed'
  }
  return report
}
