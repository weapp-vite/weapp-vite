import type { BindingAnalysis, BindingInput } from './source'

export interface BindingNative {
  analyzeBindingExpressionsNative: (inputs: BindingInput[], ignoredGlobals: string[]) => Array<BindingAnalysis | null>
}

export type BindingAnalyzer = (input: BindingInput) => BindingAnalysis | null

export function replayWithJs(inputs: BindingInput[], analyze: BindingAnalyzer, deduplicate: boolean) {
  const cache = new Map<string, BindingAnalysis | null>()
  return inputs.map((input) => {
    if (!deduplicate) {
      return analyze(input)
    }
    const key = JSON.stringify(input)
    if (!cache.has(key)) {
      cache.set(key, analyze(input))
    }
    return cache.get(key)!
  })
}

/** 同一批次先按完整请求去重，再一次跨界；不把结果缓存到下一次编译。 */
export function replayWithNative(inputs: BindingInput[], binding: BindingNative, ignoredGlobals: string[]) {
  const unique: BindingInput[] = []
  const indices = new Map<string, number>()
  const order = inputs.map((input) => {
    const key = JSON.stringify(input)
    let index = indices.get(key)
    if (index === undefined) {
      index = unique.length
      indices.set(key, index)
      unique.push(input)
    }
    return index
  })
  const result = unique.length ? binding.analyzeBindingExpressionsNative(unique, ignoredGlobals) : []
  if (result.length !== unique.length) {
    throw new Error('Native batch result length differs from unique input count')
  }
  for (const analysis of result) {
    if (analysis === null) {
      continue
    }
    if (!analysis || typeof analysis.snapshotFallback !== 'boolean' || !Array.isArray(analysis.dependencies)
      || analysis.dependencies.some(dependency => typeof dependency.root !== 'string'
        || (dependency.path !== undefined && typeof dependency.path !== 'string')
        || !['exact-path', 'top-level'].includes(dependency.mode))) {
      throw new TypeError('Malformed native binding analysis')
    }
  }
  return { results: order.map(index => result[index]!), uniqueInputs: unique.length, nativeCalls: unique.length ? 1 : 0 }
}

/** 运行错误整批回退；正确性报告仍把任何回退视为实验未通过。 */
export function replayWithFallback(inputs: BindingInput[], binding: BindingNative, ignoredGlobals: string[], analyze: BindingAnalyzer) {
  try {
    return { ...replayWithNative(inputs, binding, ignoredGlobals), fallback: undefined }
  }
  catch (error) {
    return { results: replayWithJs(inputs, analyze, true), uniqueInputs: undefined, nativeCalls: undefined, fallback: String(error) }
  }
}
