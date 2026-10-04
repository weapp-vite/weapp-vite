import type { CompilerObservation, CompilerProfileSpan, ObservedCompilerResult } from './types'
import { AsyncLocalStorage } from 'node:async_hooks'
import { performance } from 'node:perf_hooks'
import process from 'node:process'

interface Recorder {
  startedAt: number
  cpu: NodeJS.CpuUsage
  nextId: number
  spans: CompilerProfileSpan[]
  counters: CompilerObservation['counters']
}

interface Context {
  recorder: Recorder
  parentId?: number
}

const storage = new AsyncLocalStorage<Context>()
let activeObservers = 0

function context() {
  return activeObservers ? storage.getStore() : undefined
}

function createRecorder(): Recorder {
  return { startedAt: performance.now(), cpu: process.cpuUsage(), nextId: 0, spans: [], counters: {} }
}

function coveredDuration(spans: CompilerProfileSpan[], start: number, end: number) {
  const intervals = spans.map(span => [Math.max(start, span.startMs), Math.min(end, span.endMs)] as const)
    .filter(([left, right]) => right > left)
    .sort((a, b) => a[0] - b[0])
  let covered = 0
  let cursor = start
  for (const [left, right] of intervals) {
    covered += Math.max(0, right - Math.max(cursor, left))
    cursor = Math.max(cursor, right)
  }
  return covered
}

function finish<T>(recorder: Recorder, value: T): ObservedCompilerResult<T> {
  const wallMs = performance.now() - recorder.startedAt
  const cpu = process.cpuUsage(recorder.cpu)
  const spans = recorder.spans.sort((a, b) => a.id - b.id)
  for (const span of spans) {
    span.selfWallMs = Math.max(0, span.wallMs - coveredDuration(spans.filter(child => child.parentId === span.id), span.startMs, span.endMs))
  }
  return {
    value,
    observation: {
      wallMs,
      cpu: { userMs: cpu.user / 1000, systemMs: cpu.system / 1000, scope: 'process' },
      spans,
      counters: { ...recorder.counters },
      unattributedWallMs: Math.max(0, wallMs - coveredDuration(spans.filter(span => span.parentId === undefined), 0, wallMs)),
      coverage: {
        durations: 'inclusive wall time; nested spans must not be added',
        cpu: 'process-wide CPU during the root call; not phase CPU or exclusive thread CPU',
        counters: 'compiler Babel wrapper calls only; Vue, Oxc and native internal parses are not counted',
      },
    },
  }
}

/** 仅供仓库诊断使用；不加入编译器公开导出或修改编译选项。 */
export function observeCompiler<T>(run: () => T): ObservedCompilerResult<T> {
  const recorder = createRecorder()
  activeObservers++
  try {
    return finish(recorder, storage.run({ recorder }, run))
  }
  finally {
    activeObservers--
  }
}

/** 异步编译观测按调用隔离，等待真实入口完成后再采集进程 CPU。 */
export async function observeCompilerAsync<T>(run: () => Promise<T>): Promise<ObservedCompilerResult<T>> {
  const recorder = createRecorder()
  activeObservers++
  try {
    return finish(recorder, await storage.run({ recorder }, run))
  }
  finally {
    activeObservers--
  }
}

function startSpan(current: Context, name: string): CompilerProfileSpan {
  return {
    id: current.recorder.nextId++,
    parentId: current.parentId,
    name,
    startMs: performance.now() - current.recorder.startedAt,
    endMs: 0,
    wallMs: 0,
    selfWallMs: 0,
    status: 'failed',
  }
}

function endSpan(current: Context, span: CompilerProfileSpan) {
  span.endMs = performance.now() - current.recorder.startedAt
  span.wallMs = span.endMs - span.startMs
  current.recorder.spans.push(span)
}

/** 未开启观测时不读时钟、不建 AsyncLocalStorage 上下文。 */
export function measureCompilerStage<T>(name: string, run: () => T): T {
  const current = context()
  if (!current) {
    return run()
  }
  const span = startSpan(current, name)
  try {
    const value = storage.run({ recorder: current.recorder, parentId: span.id }, run)
    span.status = 'complete'
    return value
  }
  finally {
    endSpan(current, span)
  }
}

async function measureAsync<T>(current: Context, name: string, run: () => Promise<T>): Promise<T> {
  const span = startSpan(current, name)
  try {
    const value = await storage.run({ recorder: current.recorder, parentId: span.id }, run)
    span.status = 'complete'
    return value
  }
  finally {
    endSpan(current, span)
  }
}

/** 异步阶段只记录墙钟，等待时间不推算为计算时间。 */
export function measureCompilerStageAsync<T>(name: string, run: () => Promise<T>): Promise<T> {
  const current = context()
  return current ? measureAsync(current, name, run) : run()
}

/** 计数只代表真实 Babel 包装入口调用，不推算第三方编译器内部解析次数。 */
export function countCompilerOperation(operation: keyof CompilerObservation['counters']) {
  const current = context()
  if (current) {
    current.recorder.counters[operation] = (current.recorder.counters[operation] ?? 0) + 1
  }
}
