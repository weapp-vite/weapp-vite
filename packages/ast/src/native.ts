import type { NativeNpmChunkAnalysis, NativeNpmChunkAnalysisInput } from './native/npmChunks'
import { createRequire } from 'node:module'
import process from 'node:process'
import { isNativeCompilerScriptAnalysis } from './native/compilerAnalysis'
import { readNativeNpmChunkAnalysis } from './native/npmChunks'
import { isNativeScriptAnalysisBatchShape, readNativeScriptAnalysis } from './native/scriptAnalysis'

const require = createRequire(import.meta.url)

export interface NativeOnPageScrollDiagnostic {
  kind: 'empty' | 'setData' | 'syncApi'
  line: number
  column: number
  sourceLabel: string
  syncApi?: string
}

export interface NativeScriptAnalysis {
  hasStaticRequireLiteral: boolean
  hasPlatformApiAccess: boolean
  featureFlags: string[]
}

export interface NativeScriptAnalysisInput {
  code: string
  moduleId?: string
  hookToFeature?: Record<string, unknown>
  filename?: string
}

export interface NativeCompilerScriptInput {
  code: string
  filename?: string
}

export interface NativeCompilerScriptImport {
  local: string
  imported?: string
  source: string
  kind: 'default' | 'namespace' | 'named'
  typeOnly: boolean
}

export interface NativeCompilerRegisteredComponent {
  name: string
  local: string
}

export interface NativeCompilerScriptSpan {
  start: number
  end: number
}

export interface NativeCompilerScriptAnalysis {
  imports: NativeCompilerScriptImport[]
  defineOptionsStatements: NativeCompilerScriptSpan[]
  registeredComponents?: NativeCompilerRegisteredComponent[]
}

export type { NativeNpmChunkAnalysis, NativeNpmChunkAnalysisInput, NativeNpmLocalRootFact, NativeNpmPlatformApiFact, NativeNpmRequireFact } from './native/npmChunks'

export interface NativeAstBinding {
  analyzeCompilerScriptsNative?: (
    inputs: NativeCompilerScriptInput[],
  ) => Array<NativeCompilerScriptAnalysis | null>
  analyzeNpmChunksNative?: (
    inputs: NativeNpmChunkAnalysisInput[],
  ) => Array<NativeNpmChunkAnalysis | null>
  analyzeScriptNative?: (
    code: string,
    moduleId?: string,
    hookToFeatureJson?: string,
    filename?: string,
  ) => NativeScriptAnalysis
  analyzeScriptsNative?: (
    inputs: Array<{
      code: string
      moduleId?: string
      hookToFeatureJson?: string
      filename?: string
    }>,
  ) => NativeScriptAnalysis[]
  collectFeatureFlagsNative?: (
    code: string,
    moduleId: string,
    hookToFeatureJson: string,
    filename?: string,
  ) => string[]
  collectOnPageScrollDiagnosticsNative?: (
    code: string,
    filename?: string,
  ) => NativeOnPageScrollDiagnostic[]
  mayContainPlatformApiAccessNative?: (
    code: string,
    filename?: string,
  ) => boolean
  mayContainStaticRequireLiteralNative?: (
    code: string,
    filename?: string,
  ) => boolean
}

let binding: NativeAstBinding | false | undefined
let lastScriptAnalysis:
  | {
    key: string
    result: NativeScriptAnalysis
  }
  | undefined

function resolveNativeAstModulePath() {
  const modulePath = process.env.WEAPP_VITE_NATIVE_AST_PATH?.trim()
  return modulePath || undefined
}

function createScriptAnalysisKey(code: string, filename: string, moduleId?: string, hookToFeatureJson?: string) {
  return [code, filename, moduleId ?? '', hookToFeatureJson ?? ''].join('\0')
}

export function shouldUseNativeAst() {
  return process.env.WEAPP_VITE_NATIVE === '1' && Boolean(resolveNativeAstModulePath())
}

export function shouldUseNativeNpmChunkAnalysis() {
  return shouldUseNativeAst() && process.env.WEAPP_VITE_NATIVE_NPM_CHUNK === '1'
}

export function loadNativeAstBindingSync() {
  if (!shouldUseNativeAst()) {
    return undefined
  }
  if (binding !== undefined) {
    return binding || undefined
  }

  try {
    binding = require(resolveNativeAstModulePath()!) as NativeAstBinding
  }
  catch {
    binding = false
  }

  return binding || undefined
}

export function analyzeScriptWithNative(
  code: string,
  options?: {
    filename?: string
    moduleId?: string
    hookToFeature?: Record<string, unknown>
  },
) {
  const analyzeNative = loadNativeAstBindingSync()?.analyzeScriptNative
  if (!analyzeNative) {
    return undefined
  }

  const hookToFeatureJson = options?.hookToFeature
    ? JSON.stringify(options.hookToFeature)
    : undefined
  const filename = options?.filename ?? 'inline.ts'
  const key = createScriptAnalysisKey(code, filename, options?.moduleId, hookToFeatureJson)
  if (lastScriptAnalysis?.key === key) {
    return lastScriptAnalysis.result
  }

  const rawResult: unknown = analyzeNative(code, options?.moduleId, hookToFeatureJson, filename)
  const result = readNativeScriptAnalysis(rawResult)
  if (!result) {
    return undefined
  }
  lastScriptAnalysis = {
    key,
    result,
  }
  return result
}

export function analyzeScriptsWithNative(inputs: NativeScriptAnalysisInput[]) {
  const analyzeNative = loadNativeAstBindingSync()?.analyzeScriptsNative
  if (!analyzeNative) {
    return undefined
  }

  const nativeInputs = inputs.map((input) => {
    return {
      code: input.code,
      filename: input.filename ?? 'inline.ts',
      hookToFeatureJson: input.hookToFeature
        ? JSON.stringify(input.hookToFeature)
        : undefined,
      moduleId: input.moduleId,
    }
  })
  const rawResults: unknown = analyzeNative(nativeInputs)
  if (!isNativeScriptAnalysisBatchShape(rawResults, nativeInputs.length)) {
    return undefined
  }
  const results = nativeInputs.map((_, index) => {
    try {
      const result = readNativeScriptAnalysis(rawResults[index])
      if (result) {
        return result
      }
    }
    catch {
      // 当前数组项读取失败只拒绝该项，保留有效邻项。
    }
    return null
  })
  const lastInput = nativeInputs.at(-1)
  const lastResult = results.at(-1)
  if (lastInput && lastResult && results.length === nativeInputs.length) {
    // 仅保留批次末项，与单文件分析共享已有的单条缓存边界。
    lastScriptAnalysis = {
      key: createScriptAnalysisKey(lastInput.code, lastInput.filename, lastInput.moduleId, lastInput.hookToFeatureJson),
      result: lastResult,
    }
  }
  return results
}

/**
 * 编译器前端批量摘要的显式 native 快速路径；失败时由调用方继续使用 Babel/Oxc。
 */
export function analyzeCompilerScriptsWithNative(inputs: NativeCompilerScriptInput[]) {
  if (!shouldUseNativeAst()) {
    return undefined
  }
  if (!inputs.length) {
    return []
  }
  const fallback = () => null
  const analyzeNative = loadNativeAstBindingSync()?.analyzeCompilerScriptsNative
  if (!analyzeNative) {
    return inputs.map(fallback)
  }

  let results: unknown
  try {
    results = analyzeNative(inputs)
  }
  catch {
    return inputs.map(fallback)
  }
  if (!Array.isArray(results) || results.length !== inputs.length) {
    return inputs.map(fallback)
  }
  return inputs.map((input, index) => {
    try {
      const result: unknown = results[index]
      return isNativeCompilerScriptAnalysis(result, input.code) ? result : fallback()
    }
    catch {
      return fallback()
    }
  })
}

/**
 * 批量读取最终 chunk 的重写事实；默认关闭，任何批次或单项校验失败都交回 JS。
 */
export function analyzeNpmChunksWithNative(inputs: NativeNpmChunkAnalysisInput[]) {
  if (!shouldUseNativeNpmChunkAnalysis() || inputs.length === 0) {
    return undefined
  }
  let rawResults: unknown
  try {
    const analyzeNative = loadNativeAstBindingSync()?.analyzeNpmChunksNative
    if (!analyzeNative) {
      return inputs.map(() => null)
    }
    rawResults = analyzeNative(inputs)
  }
  catch {
    return inputs.map(() => null)
  }
  if (!isNativeScriptAnalysisBatchShape(rawResults, inputs.length)) {
    return inputs.map(() => null)
  }
  return inputs.map((input, index) => {
    try {
      return Object.hasOwn(rawResults, index)
        ? readNativeNpmChunkAnalysis(rawResults[index], input.code) ?? null
        : null
    }
    catch {
      return null
    }
  })
}
