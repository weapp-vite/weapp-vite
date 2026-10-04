import type { TransformScriptOptions } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils'
import type { CapturedValue, CaptureExpressionTools, CaptureProperty } from './captureTypes'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import * as markers from '@weapp-core/constants'
import { parse } from '@weapp-vite/ast/babel'
import * as t from '@weapp-vite/ast/babelTypes'
import { resolveWevuInternalImportModuleId, WE_VU_INTERNAL_REACTIVITY_APIS, WE_VU_INTERNAL_TEMPLATE_APIS, WE_VU_MODULE_ID, WE_VU_PAGE_HOOK_TO_FEATURE, WE_VU_RUNTIME_APIS, WE_VU_RUNTIME_MODULE_IDS } from '../../packages-runtime/wevu-compiler/src/constants'
import { WE_VU_RUNTIME_CAPABILITY_INSTALLERS, WE_VU_RUNTIME_CAPABILITY_ORDER } from '../../packages-runtime/wevu-compiler/src/runtimeCapabilities'
import { decodeCapturedData } from './captureRead'
import { createCaptureBridgeMetrics, serializeCaptureValue } from './captureSerialize'

const optionFields = {
  isTypeScript: true,
  skipComponentTransform: true,
  isApp: true,
  isPage: true,
  templateComponentMeta: true,
  wevuDefaults: true,
  minify: true,
  sourceMap: true,
  warn: true,
  classStyleRuntime: true,
  classStyleBindings: true,
  templateRefs: true,
  layoutHosts: true,
  inlineExpressions: true,
  bindingManifest: true,
  runtimeBindingManifest: true,
  autoSetDataPick: true,
  pageLayout: true,
  runtimeCapabilities: true,
  functionPropPaths: true,
  propsAliases: true,
  propsDerivedKeys: true,
  relaxStructuredTypeOnlyProps: true,
  scopedSlotHostProperties: true,
  cssModules: true,
  stabilizeCssVarsRuntime: true,
} satisfies Record<keyof TransformScriptOptions, true>
const expressionFields = new Set(['expAst', 'rawExpAst', 'listExpAst', 'rawListExpAst', 'projectedListExpAst'])
const sourcePrefix = 'packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/'
const contractFiles = { imports: `${sourcePrefix}imports.ts`, installers: `${sourcePrefix}runtimeCapabilityInjection.ts`, export: `${sourcePrefix}rewrite/export.ts`, classStyle: `${sourcePrefix}rewrite/classStyle.ts` }

export type ScriptRequestValue
  = | Exclude<CapturedValue, { kind: 'object' | 'ast-expression' }>
    | { kind: 'object', prototype: 'Object' | 'null' | 'Array', properties: Array<Omit<CaptureProperty, 'value'> & { value: ScriptRequestValue }> }
    | { kind: 'expression-source', role: string, id: number, nodeType: string, source: string, originalSpan: CapturedValue }

export type ScriptRequestInput
  = | { kind: 'captured', options: CapturedValue }
    | { kind: 'live', options: TransformScriptOptions | undefined, expressions: CaptureExpressionTools, transferKey?: symbol }

function initializer(source: string, name: string): t.Expression {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] })
  const found: t.VariableDeclarator[] = []
  t.traverseFast(ast, (node) => {
    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id, { name })) {
      found.push(node)
    }
  })
  if (found.length !== 1 || !t.isExpression(found[0].init)) {
    throw new Error(`Compiler contract declaration changed: ${name}`)
  }
  return found[0].init
}

function stringSet(source: string, name: string): string[] {
  const init = initializer(source, name)
  if (!t.isNewExpression(init) || !t.isIdentifier(init.callee, { name: 'Set' }) || init.arguments.length !== 1 || !t.isArrayExpression(init.arguments[0])) {
    throw new Error(`Compiler contract Set changed: ${name}`)
  }
  const values = init.arguments[0].elements.flatMap((element) => {
    if (t.isStringLiteral(element)) {
      return [element.value]
    }
    if (t.isSpreadElement(element) && t.isCallExpression(element.argument)) {
      const call = element.argument
      if (t.isMemberExpression(call.callee) && !call.callee.computed && t.isIdentifier(call.callee.object, { name: 'Object' })
        && t.isIdentifier(call.callee.property, { name: 'values' }) && call.arguments.length === 1
        && t.isIdentifier(call.arguments[0], { name: 'WE_VU_RUNTIME_CAPABILITY_INSTALLERS' })) {
        return Object.values(WE_VU_RUNTIME_CAPABILITY_INSTALLERS)
      }
    }
    throw new Error(`Unsupported compiler contract Set member: ${name}`)
  })
  if (new Set(values).size !== values.length || !values.length) {
    throw new Error(`Duplicate or empty compiler contract Set: ${name}`)
  }
  return values
}

/** 从私有静态声明提取契约并校验 AST 形状，不执行源码，不在 Rust 手写第二份迁移表。 */
export function createScriptRequestContract(sources = Object.fromEntries(Object.entries(contractFiles).map(([key, filename]) => [key, readFileSync(new URL(`../../${filename}`, import.meta.url), 'utf8')])) as Record<keyof typeof contractFiles, string>) {
  const helperObject = initializer(sources.classStyle, 'helpers')
  if (!t.isObjectExpression(helperObject)) {
    throw new Error('Compiler class/style helper declaration changed')
  }
  const classStyleHelpers: Record<string, string> = {}
  for (const property of helperObject.properties) {
    if (!t.isObjectProperty(property) || property.computed || !t.isIdentifier(property.key)
      || !t.isCallExpression(property.value) || !t.isMemberExpression(property.value.callee)
      || property.value.callee.computed || !t.isIdentifier(property.value.callee.object, { name: 't' })
      || !t.isIdentifier(property.value.callee.property, { name: 'identifier' }) || property.value.arguments.length !== 1
      || !t.isStringLiteral(property.value.arguments[0]) || Object.hasOwn(classStyleHelpers, property.key.name)) {
      throw new Error('Unsupported class/style helper declaration')
    }
    classStyleHelpers[property.key.name] = property.value.arguments[0].value
  }
  if (Object.keys(classStyleHelpers).join(',') !== 'normalizeClass,normalizeStyle,unref,resolvePropValue') {
    throw new Error('Class/style helper keys changed')
  }
  const movableWevuImports = stringSet(sources.imports, 'INTERNAL_RUNTIME_VALUE_EXPORTS')
  const movedVueImports = stringSet(sources.imports, 'movedVueRuntimeAPIs')
  const locals = initializer(sources.installers, 'INSTALLER_LOCAL_NAMES')
  const defaultOptions = initializer(sources.export, 'DEFAULT_OPTIONS_IDENTIFIER')
  if (!t.isObjectExpression(locals) || !t.isStringLiteral(defaultOptions)) {
    throw new Error('Compiler helper declaration changed')
  }
  const installerLocalNames: Record<string, string> = {}
  for (const property of locals.properties) {
    if (!t.isObjectProperty(property) || property.computed || !t.isIdentifier(property.key) || !t.isStringLiteral(property.value)
      || Object.hasOwn(installerLocalNames, property.key.name)) {
      throw new Error('Unsupported installer local name')
    }
    installerLocalNames[property.key.name] = property.value.value
  }
  if (Object.keys(installerLocalNames).join(',') !== WE_VU_RUNTIME_CAPABILITY_ORDER.join(',')) {
    throw new Error('Installer local names differ from capability order')
  }
  const apiNames = [...new Set([...movableWevuImports, ...movedVueImports, ...WE_VU_INTERNAL_REACTIVITY_APIS, ...WE_VU_INTERNAL_TEMPLATE_APIS, ...Object.values(WE_VU_RUNTIME_APIS), ...Object.values(WE_VU_RUNTIME_CAPABILITY_INSTALLERS)])]
  return {
    markers: Object.fromEntries(Object.entries(markers).filter(([name, value]) => name.startsWith('WEVU_') && (typeof value === 'string' || typeof value === 'number'))),
    runtime: {
      contractVersion: markers.WEAPP_VITE_RUNTIME_CONTRACT_VERSION,
      publicModule: WE_VU_MODULE_ID,
      pageFeatureModules: [...WE_VU_RUNTIME_MODULE_IDS, 'wevu/router', 'wevu/dev/router'],
      classStyleHelpers,
      recognizedModules: [...WE_VU_RUNTIME_MODULE_IDS],
      apis: { ...WE_VU_RUNTIME_APIS },
      apiModules: Object.fromEntries(apiNames.map(name => [name, resolveWevuInternalImportModuleId(name)])),
      fallbackModule: resolveWevuInternalImportModuleId(''),
      pageHookToFeature: { ...WE_VU_PAGE_HOOK_TO_FEATURE },
      capabilityOrder: [...WE_VU_RUNTIME_CAPABILITY_ORDER],
      capabilityInstallers: { ...WE_VU_RUNTIME_CAPABILITY_INSTALLERS },
      movableWevuImports,
      movedVueImports,
      installerLocalNames,
      defaultOptionsIdentifier: defaultOptions.value,
    },
    extractedSources: Object.fromEntries(Object.entries(contractFiles).map(([key, filename]) => [filename, createHash('sha256').update(sources[key as keyof typeof sources]).digest('hex')])),
  }
}

let sharedContract: ReturnType<typeof createScriptRequestContract> | undefined
let initialization: { durationMs: number, sourceReads: number, parseCalls: number } | undefined

/** 单独保留进程首次契约提取的启动成本，避免把不稳定计时字段放进可配对请求。 */
export function scriptRequestContractSnapshot() {
  return { initialized: sharedContract !== undefined, initialization: initialization && { ...initialization }, extractedSources: { ...sharedContract?.extractedSources } }
}

/** 无损传递所有声明选项；跨界只传数据和所有权描述，Rust 负责重新解析表达式源码。 */
export function buildTransformScriptRequest(input: ScriptRequestInput) {
  if (!['live', 'captured'].includes(input.kind)) {
    throw new TypeError('Unknown script request input kind')
  }
  const bridge = createCaptureBridgeMetrics()
  const captured = input.kind === 'captured'
    ? input.options
    : serializeCaptureValue(input.options, { inputOptions: true, transferKey: input.transferKey, expressions: input.expressions })
  if (captured.kind !== 'undefined' && (captured.kind !== 'object' || captured.prototype === 'Array')) {
    throw new TypeError('Script request options must be undefined or a plain object')
  }
  const expressionIdentities = new Map<number, string>()
  const visit = (value: CapturedValue, path: string, role?: string): ScriptRequestValue => {
    if (role && expressionFields.has(role) && !['ast-expression', 'undefined', 'null'].includes(value.kind)) {
      throw new TypeError(`Expression AST was not bridged at ${path}`)
    }
    if (value.kind === 'ast-expression') {
      if (!role || !expressionFields.has(role) || !Number.isSafeInteger(value.id) || value.id < 1
        || typeof value.nodeType !== 'string' || !value.nodeType || typeof value.generatedSource !== 'string') {
        throw new TypeError(`Invalid expression bridge at ${path}`)
      }
      decodeCapturedData(value.originalSpan)
      const identity = JSON.stringify([value.nodeType, value.generatedSource, value.originalSpan])
      if (expressionIdentities.has(value.id) && expressionIdentities.get(value.id) !== identity) {
        throw new TypeError(`Conflicting expression identity at ${path}`)
      }
      expressionIdentities.set(value.id, identity)
      bridge.expressionCount++
      bridge.generatedUtf16Chars += value.generatedSource.length
      return { kind: 'expression-source', role, id: value.id, nodeType: value.nodeType, source: value.generatedSource, originalSpan: structuredClone(value.originalSpan) }
    }
    if (value.kind === 'callback') {
      if (path !== '$.warn' || value.role !== 'options.warn' || value.ownership !== 'caller; never transferred') {
        throw new TypeError(`Unsupported callback ownership at ${path}`)
      }
      return { ...value }
    }
    if (value.kind === 'opaque') {
      if (path !== '$.[owned-transfer]' || value.role !== 'script baseline AST transfer' || value.ownership !== 'existing baseline loader; never consumed'
        || !['undefined', 'object', 'null', 'function', 'string', 'number', 'boolean', 'symbol', 'bigint'].includes(value.valueKind)) {
        throw new TypeError(`Unsupported transfer ownership at ${path}`)
      }
      return { ...value }
    }
    if (value.kind !== 'object') {
      decodeCapturedData(value)
      return { ...value }
    }
    if (!['Object', 'null', 'Array'].includes(value.prototype) || !Array.isArray(value.properties)) {
      throw new TypeError(`Invalid object at ${path}`)
    }
    const keys = new Set<string>()
    return { kind: 'object', prototype: value.prototype, properties: value.properties.map((property) => {
      const key = property.key
      const symbol = typeof key !== 'string'
      const name = symbol ? '[owned-transfer]' : key
      if (keys.has(name) || [property.enumerable, property.configurable, property.writable].some(flag => typeof flag !== 'boolean')
        || (symbol && (path !== '$' || !key || key.symbol !== 'script baseline AST transfer' || property.value.kind !== 'opaque'))
        || (!symbol && path === '$' && !Object.hasOwn(optionFields, key))) {
        throw new TypeError(`Unknown, duplicate or invalid request property at ${path}.${name}`)
      }
      keys.add(name)
      return { key: structuredClone(key), enumerable: property.enumerable, configurable: property.configurable, writable: property.writable, value: visit(property.value, `${path}.${name}`, symbol ? undefined : key) }
    }) }
  }
  const options = visit(captured, '$')
  if (!sharedContract) {
    const started = performance.now()
    sharedContract = createScriptRequestContract()
    initialization = { durationMs: performance.now() - started, sourceReads: 4, parseCalls: 5 }
  }
  return { schemaVersion: 1 as const, options, contract: structuredClone(sharedContract), bridge }
}

export type TransformScriptRequest = ReturnType<typeof buildTransformScriptRequest>

/** 直接生成唯一跨界请求；没有 Babel 节点、函数或 native AST token 进入 JSON。 */
export function serializeTransformScriptRequest(input: ScriptRequestInput) {
  return JSON.stringify(buildTransformScriptRequest(input))
}
