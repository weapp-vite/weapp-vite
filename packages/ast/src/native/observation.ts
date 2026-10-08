import { AsyncLocalStorage } from 'node:async_hooks'
import { Buffer } from 'node:buffer'
import { channel } from 'node:diagnostics_channel'

export interface NativeAnalysisStats {
  bindingCalls: number
  batchCalls: number
  inputScripts: number
  inputBytes: number
  cacheHits: number
  fallbacks: number
  loadFailures: number
}

const observation = new AsyncLocalStorage<NativeAnalysisStats>()
const events = channel('weapp-vite.ast.native-analysis')
let activeObservers = 0

type NativeAnalysisEvent
  = | { kind: 'call', batch: boolean, inputScripts: number, inputBytes: number }
    | { kind: 'cacheHits' | 'fallbacks' | 'loadFailures' }

function receiveEvent(message: unknown) {
  const stats = observation.getStore()
  if (!stats) {
    return
  }
  const event = message as NativeAnalysisEvent
  if (event.kind === 'call') {
    stats.bindingCalls += 1
    stats.batchCalls += Number(event.batch)
    stats.inputScripts += event.inputScripts
    stats.inputBytes += event.inputBytes
    return
  }
  stats[event.kind] += 1
}

/**
 * 仅在诊断作用域内记录 native 调用；这些计数不代表 Rust 内部实际 parse 次数。
 */
export async function observeNativeAnalysis<T>(run: () => T | Promise<T>) {
  const stats: NativeAnalysisStats = {
    bindingCalls: 0,
    batchCalls: 0,
    inputScripts: 0,
    inputBytes: 0,
    cacheHits: 0,
    fallbacks: 0,
    loadFailures: 0,
  }
  if (activeObservers++ === 0) {
    events.subscribe(receiveEvent)
  }
  try {
    const value = await observation.run(stats, run)
    return { value, stats: { ...stats } }
  }
  finally {
    if (--activeObservers === 0) {
      events.unsubscribe(receiveEvent)
    }
  }
}

export function recordNativeCall(input: string | ReadonlyArray<{ code: string }>) {
  if (!events.hasSubscribers) {
    return
  }
  if (typeof input === 'string') {
    events.publish({ kind: 'call', batch: false, inputScripts: 1, inputBytes: Buffer.byteLength(input) } satisfies NativeAnalysisEvent)
    return
  }
  let inputBytes = 0
  for (const { code } of input) {
    inputBytes += Buffer.byteLength(code)
  }
  events.publish({ kind: 'call', batch: true, inputScripts: input.length, inputBytes } satisfies NativeAnalysisEvent)
}

export function recordNativeEvent(event: 'cacheHits' | 'fallbacks' | 'loadFailures') {
  if (events.hasSubscribers) {
    events.publish({ kind: event } satisfies NativeAnalysisEvent)
  }
}

export function invokeNativeCall<T>(input: string | ReadonlyArray<{ code: string }>, invoke: () => T): T {
  recordNativeCall(input)
  try {
    return invoke()
  }
  catch (error) {
    recordNativeEvent('fallbacks')
    throw error
  }
}
