import type { SetDataDebugInfo } from '../src/index'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { cpus } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { createApp, nextTick } from '../src/index'

const output = process.argv[2]
if (!output) {
  throw new Error('Usage: node --expose-gc --import tsx packages-runtime/wevu/scripts/benchmark-setdata-observation.ts <output.json>')
}
const iterations = 200
const rounds = 12
type Strategy = 'diff' | 'patch'
type Workload = 'scalar' | 'list'
type Phase = NonNullable<SetDataDebugInfo['phase']>

async function sourceIdentity() {
  const sourceRoot = path.resolve(import.meta.dirname, '../src')
  const hash = createHash('sha256')
  for (const file of (await readdir(sourceRoot, { recursive: true })).filter(file => file.endsWith('.ts')).sort()) {
    hash.update(file.replaceAll('\\', '/'))
    hash.update(await readFile(path.join(sourceRoot, file)))
  }
  return {
    wevuSourceSha256: hash.digest('hex'),
    lockfileSha256: createHash('sha256').update(await readFile(path.resolve(import.meta.dirname, '../../../pnpm-lock.yaml'))).digest('hex'),
    runnerSha256: createHash('sha256').update(await readFile(path.join(import.meta.dirname, 'benchmark-setdata-observation.ts'))).digest('hex'),
  }
}

async function sample(strategy: Strategy, workload: Workload, enabled: boolean, round: number) {
  let physicalCalls = 0
  let phaseEvents = 0
  let prepareMs = 0
  let unknownPrepare = 0
  let commitMs = 0
  let unknownCommit = 0
  const dispatches = new Map<number, NonNullable<Phase['dispatch']>>()
  const app = createApp({
    data: () => ({ count: 0, items: Array.from({ length: 1000 }, (_, id) => ({ id, value: 0 })) }),
    setData: {
      strategy,
      loopWarning: false,
      debugPhases: enabled,
      debugWhen: 'always',
      debug: enabled
        ? (info) => {
            const phase = info.phase
            if (!phase) {
              return
            }
            phaseEvents += 1
            if (phase.name === 'prepare') {
              if (phase.prepareDurationMs === null) {
                unknownPrepare += 1
              }
              else {
                prepareMs += phase.prepareDurationMs
              }
            }
            if (phase.name === 'commit') {
              if (phase.commitDurationMs === null) {
                unknownCommit += 1
              }
              else {
                commitMs += phase.commitDurationMs
              }
            }
            if (phase.dispatch) {
              dispatches.set(phase.dispatch.id, phase.dispatch)
            }
          }
        : undefined,
    },
  })
  const runtime = app.mount({ setData: () => {
    physicalCalls += 1
  } })
  async function update(index: number) {
    runtime.state.count += 1
    if (workload === 'list') {
      runtime.state.items[index % 1000]!.value += 1
    }
    await nextTick()
  }
  for (let index = 0; index < 30; index++) {
    await update(index)
  }
  physicalCalls = 0
  phaseEvents = 0
  prepareMs = 0
  commitMs = 0
  unknownPrepare = 0
  unknownCommit = 0
  dispatches.clear()
  globalThis.gc?.()
  const memoryBefore = process.memoryUsage()
  const started = performance.now()
  for (let index = 0; index < iterations; index++) {
    await update(index)
  }
  const elapsedMs = performance.now() - started
  const memoryAfter = process.memoryUsage()
  runtime.unmount()
  if (physicalCalls !== iterations || (enabled && dispatches.size !== physicalCalls)) {
    throw new Error('Incomplete benchmark: physical call accounting diverged')
  }
  const calls = [...dispatches.values()]
  return {
    strategy,
    workload,
    enabled,
    round,
    iterations,
    elapsedMs,
    physicalCalls,
    phaseEvents,
    payloadBytes: !enabled || calls.some(call => call.payloadBytes === null)
      ? null
      : calls.reduce((sum, call) => sum + call.payloadBytes!, 0),
    prepareMs: !enabled || unknownPrepare ? null : prepareMs,
    commitMs: !enabled || unknownCommit ? null : commitMs,
    completion: 'return',
    visibleAt: null,
    memoryBefore,
    memoryAfter,
  }
}

const source = await sourceIdentity()
const samples = []
for (const strategy of ['diff', 'patch'] as const) {
  for (const workload of ['scalar', 'list'] as const) {
    for (let round = 0; round < rounds; round++) {
      for (const enabled of round % 2 ? [true, false] : [false, true]) {
        samples.push(await sample(strategy, workload, enabled, round))
      }
    }
  }
}
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify({
  version: 1,
  source,
  capturedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model, gcAvailable: typeof globalThis.gc === 'function' },
  scope: 'Node adapter observation overhead; source runtime; not a preset or host rendering benchmark',
  notes: ['Date.now phase resolution is milliseconds', 'heap deltas include allocation and natural GC, not retained memory', 'enabled includes measurement callback and JSON byte counting', 'disabled bytes and phases are unknown'],
  samples,
}, null, 2)}\n`)
