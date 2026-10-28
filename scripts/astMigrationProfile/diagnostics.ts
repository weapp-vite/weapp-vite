import type { Counters } from './types'
import { Module } from 'node:module'
import { PerformanceObserver } from 'node:perf_hooks'
import { readNativeCompilerScriptAnalysis } from '../../packages/ast/src/native/compilerAnalysis'

type Callable = (...args: unknown[]) => unknown
interface GcEntry { startTime: number, duration: number }

/** 以真实编译起止时间筛选事件，排除异步送达的准备阶段 GC。 */
export function summarizeCompileGc(entries: readonly GcEntry[], startedAt: number, endedAt: number) {
  const relevant = entries.filter(entry => entry.startTime >= startedAt && entry.startTime < endedAt)
  return { count: relevant.length, durationMs: relevant.reduce((total, entry) => total + entry.duration, 0) }
}

export function createCounters(): Counters {
  return {
    crossings: {},
    compilerBatchCalls: 0,
    compilerBatchInputs: 0,
    compilerBatchUniqueInputs: 0,
    compilerBatchRejectedInputs: 0,
    nativeThrownCalls: 0,
    rustParseCount: null,
    babelParseCount: 0,
    babelTraverseCount: 0,
    babelGenerateCount: 0,
    sfcParseCount: 0,
    fallbackCount: null,
  }
}

/** 诊断进程中拦截真正 CJS 依赖调用；wall 进程不安装此钩子。 */
export function installDiagnostics(binding: Record<string, unknown> | undefined) {
  const counters = createCounters()
  const unique = new Set<string>()
  const gc = { count: 0, durationMs: 0 }
  const gcEntries: GcEntry[] = []
  const observer = new PerformanceObserver((list) => {
    gcEntries.push(...list.getEntries())
  })
  const moduleLoader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
  const previous = moduleLoader._load
  const proxies = new WeakMap<object, object>()
  const wrap = (value: object, methods: Record<string, keyof Counters>) => {
    const cached = proxies.get(value)
    if (cached) {
      return cached
    }
    const proxy = new Proxy(value, { get(target, key, receiver) {
      const member: unknown = Reflect.get(target, key, receiver)
      const counter = typeof key === 'string' ? methods[key] : undefined
      if (!counter || typeof member !== 'function') {
        return member
      }
      return (...args: unknown[]) => {
        (counters[counter] as number)++
        return Reflect.apply(member, target, args)
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
      return wrap(value, { parse: 'babelParseCount' })
    }
    if (id === '@babel/traverse') {
      return wrap(value, { default: 'babelTraverseCount' })
    }
    if (id === '@babel/generator') {
      return wrap(value, { default: 'babelGenerateCount' })
    }
    if (id === 'vue/compiler-sfc' || id === '@vue/compiler-sfc') {
      return wrap(value, { parse: 'sfcParseCount' })
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
              unique.add(JSON.stringify([input.code, input.filename]))
            }
            counters.compilerBatchUniqueInputs = unique.size
          }
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
