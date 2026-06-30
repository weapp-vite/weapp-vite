import { createRequire } from 'node:module'
import process from 'node:process'

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

export interface NativeAstBinding {
  analyzeScriptNative?: (
    code: string,
    moduleId?: string,
    hookToFeatureJson?: string,
    filename?: string,
  ) => NativeScriptAnalysis
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
  getVueSfcSignaturePayloadNative?: (source: string) => string | undefined
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
    binding = false
  }

  return binding || undefined
}

export function analyzeScriptWithNative(
  code: string,
  options?: {
    filename?: string
    moduleId?: string
    hookToFeature?: Record<string, string>
  },
) {
  const analyzeNative = loadNativeAstBindingSync()?.analyzeScriptNative
  if (!analyzeNative) {
    return undefined
  }

  const hookToFeatureJson = options?.hookToFeature
    ? JSON.stringify(options.hookToFeature)
    : undefined
  const key = [
    code,
    options?.filename ?? '',
    options?.moduleId ?? '',
    hookToFeatureJson ?? '',
  ].join('\0')
  if (lastScriptAnalysis?.key === key) {
    return lastScriptAnalysis.result
  }

  const result = analyzeNative(code, options?.moduleId, hookToFeatureJson, options?.filename ?? 'inline.ts')
  lastScriptAnalysis = {
    key,
    result,
  }
  return result
}
