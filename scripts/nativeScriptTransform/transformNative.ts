import type { TransformResult } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { createWevuRuntimeCapabilityMetadata, WE_VU_RUNTIME_CAPABILITY_ORDER } from '../../packages-runtime/wevu-compiler/src/runtimeCapabilities'
import { digest } from './identity'

interface Diagnostic { message: string, labels: { start: number, end: number }[] }
interface OutcomeBase { warnings: string[], diagnostics: Diagnostic[], omittedUndefined: string[] }
export type NativeTransformOutcome
  = | (OutcomeBase & { status: 'ok', resultJson: string, result: TransformResult })
    | (OutcomeBase & { status: 'unsupported' | 'parse-error' | 'semantic-error', unsupportedReason?: string })

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError('Expected a native script object')
  }
  return value as Record<string, unknown>
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) {
    throw new TypeError('Unexpected native script result field')
  }
}

function requestContext(json: string) {
  const request = object(JSON.parse(json) as unknown)
  if (request.schemaVersion !== 1) {
    throw new TypeError('Unsupported native script request version')
  }
  object(request.contract)
  const options = object(request.options)
  if (options.kind !== 'undefined' && (options.kind !== 'object' || !['Object', 'null'].includes(String(options.prototype)))) {
    throw new TypeError('Invalid native script request options')
  }
  const omitted: string[] = []
  let sourceMap = true
  const visit = (raw: unknown, current: string) => {
    const value = object(raw)
    if (value.kind === 'undefined') {
      omitted.push(current)
    }
    else if (value.kind === 'object') {
      if (!Array.isArray(value.properties)) {
        throw new TypeError('Invalid native script request properties')
      }
      for (const rawProperty of value.properties) {
        const property = object(rawProperty)
        const key = typeof property.key === 'string' ? property.key : '[owned-transfer]'
        if (current === '$' && key === 'sourceMap') {
          const option = object(property.value)
          if (option.kind !== 'undefined' && (option.kind !== 'boolean' || typeof option.value !== 'boolean')) {
            throw new TypeError('Invalid sourceMap request option')
          }
          sourceMap = option.value !== false
        }
        visit(property.value, `${current}.${key}`)
      }
    }
  }
  visit(options, '$')
  const sources: { filename: string, content: string }[] = []
  if (request.provenance !== undefined) {
    const provenance = object(request.provenance)
    if (provenance.schemaVersion !== 1 || provenance.coordinateEncoding !== 'utf16' || !Array.isArray(provenance.sources)) {
      throw new TypeError('Invalid native provenance sources')
    }
    const filenames = new Set(['inline.ts'])
    for (const raw of provenance.sources) {
      const entry = object(raw)
      if (typeof entry.filename !== 'string' || !entry.filename || filenames.has(entry.filename) || typeof entry.content !== 'string') {
        throw new TypeError('Invalid or duplicate native provenance source')
      }
      filenames.add(entry.filename)
      sources.push({ filename: entry.filename, content: entry.content })
    }
  }
  return { sourceMap, omitted, sources }
}

function validateMap(raw: unknown, source: string, sources: { filename: string, content: string }[]) {
  const map = object(raw)
  exactKeys(map, ['version', 'file', 'names', 'sourceRoot', 'sources', 'sourcesContent', 'mappings', 'ignoreList'])
  if (![3, '3'].includes(map.version as number | string) || !strings(map.names) || !strings(map.sources)
    || !isDeepStrictEqual(map.sources, ['inline.ts', ...sources.map(entry => entry.filename)]) || typeof map.mappings !== 'string'
    || !isDeepStrictEqual(map.sourcesContent, [source, ...sources.map(entry => entry.content)])
    || (map.file !== undefined && typeof map.file !== 'string') || (map.sourceRoot !== undefined && typeof map.sourceRoot !== 'string')
    || (map.ignoreList !== undefined && (!Array.isArray(map.ignoreList) || !map.ignoreList.every(index => Number.isSafeInteger(index) && index >= 0 && index < 1 + sources.length)))) {
    throw new TypeError('Invalid native script source map')
  }
}

function validateCapabilities(raw: unknown) {
  const metadata = object(raw)
  exactKeys(metadata, ['required', 'conservative'])
  const valid = (value: unknown) => strings(value) && value.every(name => (WE_VU_RUNTIME_CAPABILITY_ORDER as readonly string[]).includes(name))
  if (!valid(metadata.required) || (metadata.conservative !== undefined && !valid(metadata.conservative))) {
    throw new TypeError('Invalid native script runtime capabilities')
  }
  const canonical = createWevuRuntimeCapabilityMetadata(metadata.required as Parameters<typeof createWevuRuntimeCapabilityMetadata>[0], metadata.conservative as Parameters<typeof createWevuRuntimeCapabilityMetadata>[1])
  if (!isDeepStrictEqual(canonical, metadata)) {
    throw new TypeError('Noncanonical native script runtime capabilities')
  }
}

function validateStyle(raw: unknown) {
  const style = object(raw)
  exactKeys(style, ['styleIsolation', 'addGlobalClass'])
  for (const key of ['styleIsolation', 'addGlobalClass']) {
    const option = object(style[key])
    exactKeys(option, ['kind', 'value'])
    if (option.kind === 'known') {
      if (!Object.hasOwn(option, 'value') || (option.value !== null && !['string', 'boolean', 'number'].includes(typeof option.value))
        || (typeof option.value === 'number' && !Number.isFinite(option.value))) {
        throw new TypeError('Invalid known native component style option')
      }
    }
    else if (!['absent', 'unknown'].includes(String(option.kind)) || Object.hasOwn(option, 'value')) {
      throw new TypeError('Invalid native component style option')
    }
  }
}

/** 严格接收完整 stage 结果；无效中间产物或遗漏声明不能被当作 native 成功。 */
export function validateNativeTransformOutcome(raw: unknown, source: string, request: string): NativeTransformOutcome {
  const output = object(raw)
  exactKeys(output, ['status', 'resultJson', 'result', 'warnings', 'unsupportedReason', 'diagnostics', 'omittedUndefined'])
  if (!['ok', 'unsupported', 'parse-error', 'semantic-error'].includes(String(output.status)) || !strings(output.warnings)
    || !strings(output.omittedUndefined) || !Array.isArray(output.diagnostics)) {
    throw new TypeError('Invalid native script outcome')
  }
  const diagnostics = output.diagnostics.map((raw) => {
    const diagnostic = object(raw)
    exactKeys(diagnostic, ['message', 'labels'])
    if (typeof diagnostic.message !== 'string' || !diagnostic.message || !Array.isArray(diagnostic.labels)) {
      throw new TypeError('Invalid native script diagnostic')
    }
    const labels = diagnostic.labels.map((raw) => {
      const label = object(raw)
      exactKeys(label, ['start', 'end'])
      if (!Number.isSafeInteger(label.start) || !Number.isSafeInteger(label.end)
        || Number(label.start) < 0 || Number(label.start) > Number(label.end) || Number(label.end) > source.length) {
        throw new TypeError('Invalid native script UTF-16 diagnostic span')
      }
      return { start: Number(label.start), end: Number(label.end) }
    })
    return { message: diagnostic.message, labels }
  })
  if (output.status !== 'ok') {
    if (output.resultJson != null || output.result != null || output.warnings.length || output.omittedUndefined.length
      || (output.status === 'unsupported'
        ? typeof output.unsupportedReason !== 'string' || !output.unsupportedReason || diagnostics.length
        : output.unsupportedReason != null || !diagnostics.length)) {
      throw new TypeError('Failed native stage published partial output or warnings')
    }
    return { status: output.status as 'unsupported' | 'parse-error' | 'semantic-error', warnings: [], diagnostics, omittedUndefined: [], ...(output.status === 'unsupported' ? { unsupportedReason: output.unsupportedReason as string } : {}) }
  }
  if (typeof output.resultJson !== 'string' || !output.resultJson || output.unsupportedReason != null || diagnostics.length) {
    throw new TypeError('Invalid successful native script outcome')
  }
  const context = requestContext(request)
  if (!isDeepStrictEqual(context.omitted, output.omittedUndefined)) {
    throw new TypeError('Native omittedUndefined differs from the request')
  }
  const result = object(JSON.parse(output.resultJson) as unknown)
  exactKeys(result, ['code', 'map', 'transformed', 'runtimeCapabilities', 'componentStyleOptions'])
  if (typeof result.code !== 'string' || typeof result.transformed !== 'boolean' || (!result.transformed && result.code !== source)) {
    throw new TypeError('Invalid native script code or transformed state')
  }
  if (!context.sourceMap && result.map != null) {
    throw new TypeError('Native ignored sourceMap:false')
  }
  if (result.map != null) {
    validateMap(result.map, source, context.sources)
  }
  else if (context.sourceMap && result.transformed) {
    throw new TypeError('Transformed native script omitted the requested source map')
  }
  if (Object.hasOwn(result, 'runtimeCapabilities')) {
    validateCapabilities(result.runtimeCapabilities)
  }
  if (Object.hasOwn(result, 'componentStyleOptions')) {
    validateStyle(result.componentStyleOptions)
  }
  return { status: 'ok', resultJson: output.resultJson, result: result as unknown as TransformResult, warnings: [...output.warnings], diagnostics: [], omittedUndefined: [...output.omittedUndefined] }
}

/** 仅加载显式实验二进制；生产 native 选择与既有可选依赖路径保持独立。 */
export async function loadScriptTransformer(filename: string) {
  if (!path.isAbsolute(filename) || path.extname(filename) !== '.node') {
    throw new Error('Expected an absolute experimental .node path')
  }
  const sha256 = digest(await readFile(filename))
  const module: unknown = createRequire(import.meta.url)(filename)
  if (!module || typeof module !== 'object' || !('transformScriptNative' in module) || typeof module.transformScriptNative !== 'function') {
    throw new TypeError('Binding lacks experimental transformScriptNative export')
  }
  const invoke = module.transformScriptNative as (source: string, request: string) => unknown
  return { sha256, transform: (source: string, request: string, observeRaw?: (raw: unknown) => void) => {
    const raw = invoke(source, request)
    observeRaw?.(raw)
    return validateNativeTransformOutcome(raw, source, request)
  } }
}

/** 失败时只回退完整 stage 一次；成功结果校验之后才交付告警，告警回调异常不重跑编译。 */
export function withTransformScriptFallback(options: {
  invoke: (source: string, request: string) => unknown
  source: string
  request: string
  fallback: () => TransformResult
  warn?: (message: string) => void
}): TransformResult {
  let outcome: NativeTransformOutcome
  try {
    outcome = validateNativeTransformOutcome(options.invoke(options.source, options.request), options.source, options.request)
  }
  catch {
    return options.fallback()
  }
  if (outcome.status !== 'ok') {
    return options.fallback()
  }
  const warn = options.warn
  for (const warning of outcome.warnings) {
    if (warn) {
      warn(warning)
    }
    else {
      console.warn(warning)
    }
  }
  return outcome.result
}
