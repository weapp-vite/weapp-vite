import type { Run } from './contract'
import { readFile, writeFile } from 'node:fs/promises'
import { TARGET } from './contract'

export interface NativeProcessObservation {
  processes: number
  completedProcesses: number
  bindingCalls: number
  batchCalls: number
  inputScripts: number
  inputBytes: number
  cacheHits: number
  fallbacks: number
  loadFailures: number
}

/** 独立诊断的 preload 从进程入口订阅现有 channel；零调用也必须留下完整进程证据。 */
export async function createDiagnosticPreload(file: string, trace: string) {
  await writeFile(file, `const fs = require('node:fs');
const { threadId } = require('node:worker_threads');
const channel = require('node:diagnostics_channel').channel('weapp-vite.ast.native-analysis');
const identity = { pid: process.pid, threadId };
const stats = { bindingCalls: 0, batchCalls: 0, inputScripts: 0, inputBytes: 0, cacheHits: 0, fallbacks: 0, loadFailures: 0 };
let invalidEvents = 0;
const write = row => fs.appendFileSync(${JSON.stringify(trace)}, JSON.stringify({ ...identity, ...row }) + '\\n');
channel.subscribe(event => {
  if (event && event.kind === 'call' && typeof event.batch === 'boolean' && Number.isSafeInteger(event.inputScripts) && event.inputScripts >= 0 && Number.isSafeInteger(event.inputBytes) && event.inputBytes >= 0) {
    stats.bindingCalls++; stats.batchCalls += Number(event.batch); stats.inputScripts += event.inputScripts; stats.inputBytes += event.inputBytes;
  } else if (event && ['cacheHits', 'fallbacks', 'loadFailures'].includes(event.kind)) {
    stats[event.kind]++;
  } else { invalidEvents++; }
});
write({ kind: 'started', nativeEnabled: process.env.WEAPP_VITE_NATIVE === '1', bindingConfigured: Boolean(process.env.WEAPP_VITE_NATIVE_AST_PATH) });
process.on('exit', exitCode => write({ kind: 'finished', exitCode, invalidEvents, stats }));
`)
}

/** 核验每个真实 CLI 子进程均从入口观察到退出；缺 preload 与没有适用工作负载分开。 */
export async function readDiagnosticObservation(trace: string, expectedProcessIds: number[]): Promise<NativeProcessObservation> {
  if (expectedProcessIds.length !== 2 || new Set(expectedProcessIds).size !== expectedProcessIds.length || expectedProcessIds.some(pid => !Number.isSafeInteger(pid) || pid <= 0)) {
    throw new Error('Missing diagnostic build process identities')
  }
  const text = await readFile(trace, 'utf8')
  const started = new Map<string, Record<string, unknown>>()
  const finished = new Map<string, Record<string, unknown>>()
  const result: NativeProcessObservation = { processes: 0, completedProcesses: 0, bindingCalls: 0, batchCalls: 0, inputScripts: 0, inputBytes: 0, cacheHits: 0, fallbacks: 0, loadFailures: 0 }
  for (const line of text.trim().split(/\r?\n/)) {
    const row = JSON.parse(line) as Record<string, unknown>
    if (!expectedProcessIds.includes(Number(row.pid)) || !Number.isSafeInteger(row.threadId) || Number(row.threadId) < 0 || !['started', 'finished'].includes(String(row.kind))) {
      throw new Error('Unexpected native diagnostic process or event')
    }
    const key = `${row.pid}:${row.threadId}`
    const records = row.kind === 'started' ? started : finished
    if (records.has(key) || (row.kind === 'finished' && !started.has(key))) {
      throw new Error('Duplicate or out-of-order native process evidence')
    }
    records.set(key, row)
  }
  for (const pid of expectedProcessIds) {
    if (!started.has(`${pid}:0`) || !finished.has(`${pid}:0`)) {
      throw new Error('Diagnostic preload did not observe the entire CLI lifetime')
    }
  }
  if (started.size !== finished.size) {
    throw new Error('Native diagnostic worker did not finish')
  }
  for (const [key, start] of started) {
    const end = finished.get(key)!
    const stats = end.stats as Record<string, unknown> | undefined
    if (start.nativeEnabled !== true || start.bindingConfigured !== true || end.exitCode !== 0 || end.invalidEvents !== 0 || !stats) {
      throw new Error('Invalid native diagnostic preload state')
    }
    for (const field of ['bindingCalls', 'batchCalls', 'inputScripts', 'inputBytes', 'cacheHits', 'fallbacks', 'loadFailures'] as const) {
      if (!Number.isSafeInteger(stats[field]) || Number(stats[field]) < 0) {
        throw new Error('Invalid native diagnostic counters')
      }
      result[field] += Number(stats[field])
    }
  }
  result.processes = expectedProcessIds.length
  result.completedProcesses = expectedProcessIds.length
  return result
}

/** 目标工程必须真正执行 native；无适用工作的对照仅可标为 not-exercised。 */
export function validNativeDiagnostic(run: Run) {
  const observation = run.native.observation
  return !run.error && run.native.failures === 0 && Boolean(observation)
    && observation!.processes === 2 && observation!.completedProcesses === 2
    && observation!.fallbacks === 0 && observation!.loadFailures === 0
    && Number.isSafeInteger(run.native.calls) && run.native.calls >= 0 && observation!.bindingCalls <= run.native.calls
    && (run.native.calls > 0 ? run.native.coverage === 'exercised' && run.native.processes > 0 : run.native.coverage === 'not-exercised')
    && (run.input !== TARGET.split(':')[1] || run.native.calls > 0)
}
