import { createRequire } from 'node:module'
import process from 'node:process'
import { invokeNativeCall, recordNativeEvent } from './native/observation'

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
  onPageScrollDiagnostics?: NativeOnPageScrollDiagnostic[]
}

export interface NativeScriptAnalysisInput {
  code: string
  moduleId?: string
  hookToFeature?: Record<string, unknown>
  filename?: string
}

export interface NativeAstBinding {
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
    code: string
    filename: string
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
    recordNativeEvent('loadFailures')
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
    if (shouldUseNativeAst()) {
      recordNativeEvent('fallbacks')
    }
    return undefined
  }

  const hookToFeatureJson = options?.hookToFeature
    ? JSON.stringify(options.hookToFeature)
    : undefined
  const filename = options?.filename ?? 'inline.ts'
  const key = createScriptAnalysisKey(code, filename, options?.moduleId, hookToFeatureJson)
  if (lastScriptAnalysis?.key === key) {
    recordNativeEvent('cacheHits')
    return lastScriptAnalysis.result
  }

  const result = invokeNativeCall(code, () => analyzeNative(code, options?.moduleId, hookToFeatureJson, filename))
  lastScriptAnalysis = {
    key,
    code,
    filename,
    result,
  }
  return result
}

/**
 * 滚动诊断与特性映射无关，但必须匹配相同源码和解析文件名才能复用。
 */
export function getCachedNativeOnPageScrollDiagnostics(code: string, filename: string) {
  if (
    lastScriptAnalysis?.code === code
    && lastScriptAnalysis.filename === filename
    && lastScriptAnalysis.result.onPageScrollDiagnostics !== undefined
  ) {
    recordNativeEvent('cacheHits')
    return lastScriptAnalysis.result.onPageScrollDiagnostics
  }
  return undefined
}

export function analyzeScriptsWithNative(inputs: NativeScriptAnalysisInput[]) {
  const analyzeNative = loadNativeAstBindingSync()?.analyzeScriptsNative
  if (!analyzeNative) {
    if (shouldUseNativeAst()) {
      recordNativeEvent('fallbacks')
    }
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
  const results = invokeNativeCall(nativeInputs, () => analyzeNative(nativeInputs))
  const lastInput = nativeInputs.at(-1)
  const lastResult = results.at(-1)
  if (lastInput && lastResult && results.length === nativeInputs.length) {
    // 仅保留批次末项，与单文件分析共享已有的单条缓存边界。
    lastScriptAnalysis = {
      code: lastInput.code,
      filename: lastInput.filename,
      key: createScriptAnalysisKey(lastInput.code, lastInput.filename, lastInput.moduleId, lastInput.hookToFeatureJson),
      result: lastResult,
    }
  }
  return results
}
