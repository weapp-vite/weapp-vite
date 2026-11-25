import type { Counters } from './types'
import { Buffer } from 'node:buffer'
import { Module } from 'node:module'
import { performance, PerformanceObserver } from 'node:perf_hooks'
import { readNativeCompilerScriptAnalysis } from '../../packages/ast/src/native/compilerAnalysis'

type Callable = (...args: unknown[]) => unknown
type CallCounter = 'babelParseCount' | 'babelTraverseCount' | 'babelGenerateCount' | 'sfcParseCount' | 'sfcCompileScriptCount'
type DurationCounter = 'babelParseDurationMs' | 'babelTraverseDurationMs' | 'babelGenerateDurationMs' | 'sfcParseDurationMs' | 'sfcCompileScriptDurationMs'
interface InstrumentedMethod { calls: CallCounter, duration: DurationCounter }
interface GcEntry { startTime: number, duration: number }

/** 以真实编译起止时间筛选事件，排除异步送达的准备阶段 GC。 */
export function summarizeCompileGc(entries: readonly GcEntry[], startedAt: number, endedAt: number) {
  const relevant = entries.filter(entry => entry.startTime >= startedAt && entry.startTime < endedAt)
  return { count: relevant.length, durationMs: relevant.reduce((total, entry) => total + entry.duration, 0) }
}

export function createCounters(): Counters {
  return {
    crossings: {},
    crossingDurationMs: {},
    compilerBatchCalls: 0,
    compilerBatchInputs: 0,
    compilerBatchUniqueInputs: 0,
    compilerBatchInputUtf8Bytes: 0,
    compilerBatchUniqueInputUtf8Bytes: 0,
    compilerBatchRejectedInputs: 0,
    compilerBatchDurationMs: 0,
    nativeThrownCalls: 0,
    rustParseCount: null,
    babelParseCount: 0,
    babelParseDurationMs: 0,
    babelTraverseCount: 0,
    babelTraverseDurationMs: 0,
    babelGenerateCount: 0,
    babelGenerateDurationMs: 0,
    sfcParseCount: 0,
    sfcParseDurationMs: 0,
    sfcCompileScriptCount: 0,
    sfcCompileScriptDurationMs: 0,
    fallbackCount: null,
  }
}

/** 诊断进程中拦截真正 CJS 依赖调用；wall 进程不安装此钩子。 */
export function installDiagnostics(binding: Record<string, unknown> | undefined) {
  const counters = createCounters()
  const unique = new Map<string, number>()
  const gc = { count: 0, durationMs: 0 }
  const gcEntries: GcEntry[] = []
  const observer = new PerformanceObserver((list) => {
    gcEntries.push(...list.getEntries())
  })
  const moduleLoader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
  const previous = moduleLoader._load
  const proxies = new WeakMap<object, object>()
  const wrap = (value: object, methods: Record<string, InstrumentedMethod>) => {
    const cached = proxies.get(value)
    if (cached) {
      return cached
    }
    const proxy = new Proxy(value, { get(target, key, receiver) {
      const member: unknown = Reflect.get(target, key, receiver)
      const method = typeof key === 'string' ? methods[key] : undefined
      if (!method || typeof member !== 'function') {
        return member
      }
      return (...args: unknown[]) => {
        Reflect.set(counters, method.calls, Number(Reflect.get(counters, method.calls)) + 1)
        const startedAt = performance.now()
        try {
          return Reflect.apply(member, target, args)
        }
        finally {
          Reflect.set(counters, method.duration, Number(Reflect.get(counters, method.duration)) + performance.now() - startedAt)
        }
      }
    } })
    proxies.set(value, proxy)
    return proxy
  }
  moduleLoader._load = (id, ...args) => {
    const value = previous.call(Module, id, ...args)
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return value
    }
    if (id === '@babel/parser') {
      return wrap(value, { parse: { calls: 'babelParseCount', duration: 'babelParseDurationMs' } })
    }
    if (id === '@babel/traverse') {
      return wrap(value, { default: { calls: 'babelTraverseCount', duration: 'babelTraverseDurationMs' } })
    }
    if (id === '@babel/generator') {
      return wrap(value, { default: { calls: 'babelGenerateCount', duration: 'babelGenerateDurationMs' } })
    }
    if (id === 'vue/compiler-sfc' || id === '@vue/compiler-sfc') {
      return wrap(value, {
        parse: { calls: 'sfcParseCount', duration: 'sfcParseDurationMs' },
        compileScript: { calls: 'sfcCompileScriptCount', duration: 'sfcCompileScriptDurationMs' },
      })
    }
    return value
  }
  const nativeProxy: Record<string, unknown> = {}
  for (const [name, member] of Object.entries(binding ?? {})) {
    nativeProxy[name] = typeof member !== 'function'
      ? member
      : (...args: unknown[]) => {
          counters.crossings[name] = (counters.crossings[name] ?? 0) + 1
          if (name === 'analyzeCompilerScriptsNative') {
            counters.compilerBatchCalls++
            const inputs = args[0] as Array<{ code: string, filename?: string }>
            counters.compilerBatchInputs += inputs.length
            for (const input of inputs) {
              const key = JSON.stringify([input.code, input.filename])
              const bytes = Buffer.byteLength(input.code, 'utf8') + Buffer.byteLength(input.filename ?? '', 'utf8')
              counters.compilerBatchInputUtf8Bytes += bytes
              unique.set(key, bytes)
            }
            counters.compilerBatchUniqueInputs = unique.size
            counters.compilerBatchUniqueInputUtf8Bytes = [...unique.values()].reduce((total, bytes) => total + bytes, 0)
          }
          const startedAt = performance.now()
          try {
            const result: unknown = Reflect.apply(member as Callable, binding, args)
            if (name === 'analyzeCompilerScriptsNative') {
              const length = (args[0] as unknown[]).length
              counters.compilerBatchRejectedInputs += Array.isArray(result) && result.length === length
                ? result.filter((value, index) => readNativeCompilerScriptAnalysis(value, (args[0] as Array<{ code: string }>)[index]!.code) === undefined).length
                : length
            }
            return result
          }
          catch (error) {
            counters.nativeThrownCalls++
            throw error
          }
          finally {
            const elapsed = performance.now() - startedAt
            counters.crossingDurationMs[name] = (counters.crossingDurationMs[name] ?? 0) + elapsed
            if (name === 'analyzeCompilerScriptsNative') {
              counters.compilerBatchDurationMs += elapsed
            }
          }
        }
  }
  return {
    counters,
    gc,
    nativeProxy,
    reset() {
      Object.assign(counters, createCounters())
      unique.clear()
      gc.count = 0
      gc.durationMs = 0
      gcEntries.length = 0
      observer.observe({ entryTypes: ['gc'] })
    },
    async finish(startedAt: number, endedAt: number) {
      await new Promise<void>(resolve => setImmediate(resolve))
      gcEntries.push(...observer.takeRecords())
      observer.disconnect()
      Object.assign(gc, summarizeCompileGc(gcEntries, startedAt, endedAt))
    },
    close() {
      observer.disconnect()
      moduleLoader._load = previous
    },
  }
}
