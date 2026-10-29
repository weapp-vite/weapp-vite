import type { FileWatchEngine } from '../../src/runtime/watch/fileWatcher'
import type { WatcherScenarioReport } from './types'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { x } from 'tinyexec'
import { runWatcherScenario } from './harness'
import { watcherComparisonIdentity } from './identity'
import { watcherScenarios } from './scenarios'

const marker = 'WATCHER_COMPARISON_REPORT='
const { values } = parseArgs({
  options: {
    engines: { type: 'string', default: 'chokidar,parcel' },
    runs: { type: 'string', default: '3' },
    report: { type: 'string' },
    child: { type: 'string' },
  },
})

function engineOf(value: string): FileWatchEngine {
  if (value !== 'chokidar' && value !== 'parcel') {
    throw new Error(`Unsupported watcher engine: ${value}`)
  }
  return value
}

function summarize(scenarios: WatcherScenarioReport[]) {
  const steps = scenarios.flatMap(scenario => scenario.steps)
  const latencies = steps.flatMap(step => step.latencyMs === null ? [] : [step.latencyMs]).sort((a, b) => a - b)
  const percentile = (percent: number) => latencies.length ? latencies[Math.ceil(latencies.length * percent) - 1] : null
  return {
    passed: scenarios.filter(scenario => scenario.status === 'passed').length,
    failed: scenarios.filter(scenario => scenario.status === 'failed').length,
    missing: steps.reduce((count, step) => count + step.missing, 0),
    duplicate: steps.reduce((count, step) => count + step.duplicate, 0),
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: latencies.at(-1) ?? null },
    startupMs: scenarios.flatMap(scenario => scenario.startupMs),
    closeMs: scenarios.flatMap(scenario => scenario.closeMs),
    cpuMs: scenarios.reduce((total, scenario) => ({ user: total.user + scenario.cpuMs.user, system: total.system + scenario.cpuMs.system }), { user: 0, system: 0 }),
    peakRssBytes: Math.max(0, ...scenarios.map(scenario => scenario.resources.peak.rssBytes)),
    peakHandles: Math.max(0, ...scenarios.map(scenario => scenario.resources.peak.handles)),
  }
}

async function main(signal: AbortSignal) {
  if (values.child) {
    const engine = engineOf(values.child)
    const identity = await watcherComparisonIdentity([engine])
    const scenarios: WatcherScenarioReport[] = []
    for (const scenario of watcherScenarios) {
      if (signal.aborted) {
        break
      }
      const result = await runWatcherScenario(engine, scenario, signal)
      scenarios.push(result)
      if (!result.cleanupConfirmed) {
        break
      }
    }
    process.stdout.write(`${marker}${JSON.stringify({
      engine,
      identity,
      planned: watcherScenarios.length,
      completed: scenarios.length,
      notRun: watcherScenarios.length - scenarios.length,
      cleanupConfirmed: scenarios.every(scenario => scenario.cleanupConfirmed),
      scenarios,
      summary: summarize(scenarios),
    })}\n`)
    process.exitCode = signal.aborted || scenarios.some(scenario => scenario.status === 'failed') ? 1 : 0
  }
  else {
    const engines = [...new Set(values.engines.split(',').map(engineOf))]
    const runs = Number(values.runs)
    if (!Number.isInteger(runs) || runs < 1 || runs > 100) {
      throw new Error('--runs must be an integer between 1 and 100')
    }
    const identity = await watcherComparisonIdentity(engines)
    const results: Array<{ run: number, engine: FileWatchEngine, exitCode: number | null, planned: number, completed: number, notRun: number, cleanupConfirmed: boolean, identity?: Awaited<ReturnType<typeof watcherComparisonIdentity>>, scenarios: WatcherScenarioReport[], summary?: ReturnType<typeof summarize>, failure?: string }> = []
    const executionOrder: string[] = []
    let cleanupBlocked = false
    for (let run = 1; run <= runs && !cleanupBlocked; run++) {
      const order = run % 2 ? engines : [...engines].reverse()
      for (const engine of order) {
        if (signal.aborted) {
          break
        }
        executionOrder.push(`${run}:${engine}`)
        process.stderr.write(`[watcher comparison] run ${run}/${runs}: ${engine}\n`)
        const childProcess = x(process.execPath, ['--import', 'tsx', import.meta.filename, '--child', engine], {
          nodeOptions: {
            cwd: path.resolve(import.meta.dirname, '../../../..'),
            env: { ...process.env, WEAPP_VITE_WATCH_ENGINE: engine },
            shell: false,
          },
          throwOnError: false,
          timeout: 180_000,
          signal,
        })
        const child = await childProcess
        const line = child.stdout.split(/\r?\n/).find(line => line.startsWith(marker))
        if (!line) {
          results.push({ run, engine, exitCode: child.exitCode ?? null, planned: watcherScenarios.length, completed: 0, notRun: watcherScenarios.length, cleanupConfirmed: false, scenarios: [], failure: childProcess.killed ? 'Child process did not exit within 180 seconds' : 'Child process did not produce a comparison report' })
          cleanupBlocked = true
          break
        }
        const report = JSON.parse(line.slice(marker.length)) as { identity: Awaited<ReturnType<typeof watcherComparisonIdentity>>, planned: number, completed: number, notRun: number, cleanupConfirmed: boolean, scenarios: WatcherScenarioReport[], summary: ReturnType<typeof summarize> }
        const identityMatches = JSON.stringify(report.identity.source) === JSON.stringify(identity.source)
          && JSON.stringify(report.identity.dependencies[engine]) === JSON.stringify(identity.dependencies[engine])
          && report.identity.lockfileSha256 === identity.lockfileSha256
          && report.identity.git.head === identity.git.head
        const failure = childProcess.killed ? 'Child process retained resources after reporting' : !identityMatches ? 'Installed dependency or source baseline changed between supervisor and worker' : undefined
        const result = { run, engine, exitCode: child.exitCode ?? null, ...report, cleanupConfirmed: report.cleanupConfirmed === true && !childProcess.killed, ...(failure ? { failure } : {}) }
        results.push(result)
        if (!result.cleanupConfirmed) {
          cleanupBlocked = true
          break
        }
      }
    }
    const report = {
      version: 1,
      recordedAt: new Date().toISOString(),
      identity,
      runtime: { node: process.version, platform: process.platform, arch: process.arch },
      parameters: { engines, runs, scenarioIds: watcherScenarios.map(scenario => scenario.id) },
      planned: engines.length * runs * watcherScenarios.length,
      completed: results.reduce((count, result) => count + result.completed, 0),
      notRun: engines.length * runs * watcherScenarios.length - results.reduce((count, result) => count + result.completed, 0),
      cleanupConfirmed: results.every(result => result.cleanupConfirmed),
      executionOrder,
      measurement: {
        latency: 'Filesystem operation start until the matching normalized notification; maximum across expected changes in each step. Public notifications do not identify the corresponding byte version.',
        verification: 'Each expected notification also requires the requested final content SHA-256, file/directory kind, or deletion state. verificationMs includes observing both conditions; it does not prove native event causality.',
        duplicate: 'Additional notifications matching the same expected path, kind and event within a 160 ms observation window; quiet steps count every unexpected notification.',
        handles: 'Diagnostic process._getActiveHandles count; active resource types are also recorded through process.getActiveResourcesInfo.',
        resources: 'RSS and active handles sampled every 20 ms and at notification boundaries; includes adapter and shared scenario driver overhead.',
        isolation: 'One child process per engine and repetition, engines alternate order; scenarios and owned resources run sequentially.',
        cleanup: 'A close failure retains the fixture and prevents subsequent scenarios, engines and repetitions. retainedFixture is relative to the resolved OS temporary directory; public close completion is not a native handle receipt.',
      },
      results,
    }
    const json = `${JSON.stringify(report, null, 2)}\n`
    if (values.report) {
      const output = path.resolve(values.report)
      await mkdir(path.dirname(output), { recursive: true })
      await writeFile(output, json)
    }
    process.stdout.write(json)
    if (signal.aborted || report.notRun || !report.cleanupConfirmed || results.some(result => result.exitCode !== 0 || result.failure || result.scenarios.some(scenario => scenario.status === 'failed'))) {
      process.exitCode = 1
    }
  }
}

const controller = new AbortController()
const stop = () => controller.abort()
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
try {
  await main(controller.signal)
}
finally {
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)
}
