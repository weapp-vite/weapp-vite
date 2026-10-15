import type { CompileVueFileOptions, VueTransformResult } from '../../packages-runtime/wevu-compiler/src/index'
import type { Outcome } from './types'
import { performance } from 'node:perf_hooks'

type CompileEntry = (source: string, filename: string, options: CompileVueFileOptions) => Promise<VueTransformResult>

export function captureError(error: unknown, seen = new Set<unknown>()): unknown {
  if (!error || typeof error !== 'object') {
    return error
  }
  if (seen.has(error)) {
    return '<circular-error>'
  }
  seen.add(error)
  const details: Record<string, unknown> = {}
  for (const key of [...new Set([...Object.getOwnPropertyNames(error), 'name', 'message', 'code', 'loc', 'cause'])]) {
    if (key === 'stack') {
      continue
    }
    const value: unknown = Reflect.get(error, key)
    if (value !== undefined) {
      details[key] = key === 'cause' ? captureError(value, seen) : value
    }
  }
  return details
}

/** 只计时真实完整入口的 awaited 调用；警告和结果保存发生在相同一次调用。 */
export async function measureRealEntry(compile: CompileEntry, source: string, filename: string, options: CompileVueFileOptions) {
  const warnings: string[] = []
  const warn = (message: string) => warnings.push(message)
  const effectiveOptions = {
    ...options,
    warn,
    autoImportTags: options.autoImportTags ? { ...options.autoImportTags, warn } : undefined,
    autoUsingComponents: options.autoUsingComponents ? { ...options.autoUsingComponents, warn } : undefined,
  }
  let outcome: Outcome
  const startedAt = performance.now()
  try {
    const result = await compile(source, filename, effectiveOptions)
    const endedAt = performance.now()
    const compileMs = endedAt - startedAt
    outcome = { status: 'success', result, warnings }
    return { compileMs, outcome, startedAt, endedAt }
  }
  catch (error) {
    const endedAt = performance.now()
    const compileMs = endedAt - startedAt
    outcome = { status: 'error', error: captureError(error), warnings }
    return { compileMs, outcome, startedAt, endedAt }
  }
}
