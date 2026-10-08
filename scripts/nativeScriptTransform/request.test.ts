import type { TransformScriptOptions } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils'
import type { CapturedValue } from './captureTypes'
import type { ScriptRequestValue } from './request'
import { createHash } from 'node:crypto'
import * as markers from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it, vi } from 'vitest'
import { resolveWevuInternalImportModuleId } from '../../packages-runtime/wevu-compiler/src/constants'
import { WE_VU_RUNTIME_CAPABILITY_INSTALLERS, WE_VU_RUNTIME_CAPABILITY_ORDER } from '../../packages-runtime/wevu-compiler/src/runtimeCapabilities'
import { decodeCapturedData } from './captureRead'
import { serializeCaptureValue } from './captureSerialize'
import { buildTransformScriptRequest, createScriptRequestContract, scriptRequestContractSnapshot, serializeTransformScriptRequest } from './request'

const expressions = { isExpression: (node: unknown) => t.isExpression(node as t.Node), generate: () => ({ code: 'count' }) }
const live = (options: TransformScriptOptions | undefined) => buildTransformScriptRequest({ kind: 'live', options, expressions })

function findExpressions<T extends CapturedValue | ScriptRequestValue>(value: T): Array<Extract<T, { kind: 'ast-expression' | 'expression-source' }>> {
  if (value.kind === 'ast-expression' || value.kind === 'expression-source') {
    return [value] as Array<Extract<T, { kind: 'ast-expression' | 'expression-source' }>>
  }
  return value.kind === 'object' ? value.properties.flatMap(property => findExpressions(property.value as T)) : []
}

function staticSources() {
  return {
    imports: `const INTERNAL_RUNTIME_VALUE_EXPORTS = new Set(['ref', ...Object.values(WE_VU_RUNTIME_CAPABILITY_INSTALLERS)]);
      function visitor() { const movedVueRuntimeAPIs = new Set(['useSlots']); }`,
    installers: `const INSTALLER_LOCAL_NAMES = { ${WE_VU_RUNTIME_CAPABILITY_ORDER.map(name => `${name}: 'local_${name}'`).join(', ')} };`,
    export: 'function rewrite() { const DEFAULT_OPTIONS_IDENTIFIER = "syntheticOptions"; }',
    classStyle: `const helpers = { normalizeClass: t.identifier('classHelper'), normalizeStyle: t.identifier('styleHelper'), unref: t.identifier('unrefHelper'), resolvePropValue: t.identifier('propHelper') };`,
  }
}

describe('versioned native script request', () => {
  it('distinguishes absent options, empty options, absent fields and explicit undefined', () => {
    expect(live(undefined).options).toEqual({ kind: 'undefined' })
    expect(live({}).options).toEqual({ kind: 'object', prototype: 'Object', properties: [] })
    const request = live({ isPage: undefined, templateRefs: [] })
    const decoded = decodeCapturedData(request.options as CapturedValue) as object
    expect(Object.hasOwn(decoded, 'isPage')).toBe(true)
    expect(Object.hasOwn(decoded, 'isApp')).toBe(false)
    expect(decoded).toEqual({ isPage: undefined, templateRefs: [] })
    expect(request.schemaVersion).toBe(1)
  })

  it('covers every current option, including undefined properties', () => {
    const options = {
      isTypeScript: undefined,
      skipComponentTransform: undefined,
      isApp: undefined,
      isPage: undefined,
      templateComponentMeta: undefined,
      wevuDefaults: undefined,
      minify: undefined,
      sourceMap: undefined,
      warn: undefined,
      classStyleRuntime: undefined,
      classStyleBindings: undefined,
      templateRefs: undefined,
      layoutHosts: undefined,
      inlineExpressions: undefined,
      bindingManifest: undefined,
      runtimeBindingManifest: undefined,
      autoSetDataPick: undefined,
      pageLayout: undefined,
      runtimeCapabilities: undefined,
      functionPropPaths: undefined,
      propsAliases: undefined,
      propsDerivedKeys: undefined,
      relaxStructuredTypeOnlyProps: undefined,
      scopedSlotHostProperties: undefined,
      cssModules: undefined,
      stabilizeCssVarsRuntime: undefined,
    } satisfies Record<keyof TransformScriptOptions, undefined>
    const decoded = decodeCapturedData(live(options).options as CapturedValue) as object
    expect(Reflect.ownKeys(decoded)).toEqual(Reflect.ownKeys(options))
    expect(decoded).toEqual(options)
  })

  it('preserves wevu defaults, runtime binding mode and nested empty/undefined values', () => {
    const options: TransformScriptOptions = { isApp: true, runtimeBindingManifest: 'diagnostic', autoSetDataPick: false, wevuDefaults: { app: {}, component: { setData: { pick: ['count'], empty: {}, missing: undefined }, options: { virtualHost: true } } } }
    const json = serializeTransformScriptRequest({ kind: 'live', options, expressions })
    const parsed = JSON.parse(json) as ReturnType<typeof live>
    expect(decodeCapturedData(parsed.options as CapturedValue)).toEqual(options)
    expect(Object.hasOwn((decodeCapturedData(parsed.options as CapturedValue) as TransformScriptOptions).wevuDefaults!.component!.setData, 'missing')).toBe(true)
  })

  it('retains array holes and undefined exactly for Rust to reject unsupported shapes', () => {
    const templateRefs: NonNullable<TransformScriptOptions['templateRefs']> = []
    templateRefs.length = 2
    Object.defineProperty(templateRefs, '1', { value: undefined, enumerable: true, writable: true, configurable: true })
    const value = decodeCapturedData(live({ templateRefs }).options as CapturedValue) as TransformScriptOptions
    expect(value.templateRefs).toHaveLength(2)
    expect(Object.hasOwn(value.templateRefs!, '0')).toBe(false)
    expect(Object.hasOwn(value.templateRefs!, '1')).toBe(true)
    expect(value.templateRefs![1]).toBeUndefined()
  })

  it('bridges live AST expressions and captures to the same source protocol without touching owners', () => {
    const transferKey = Symbol('script baseline AST transfer')
    const token = Object.defineProperty({}, 'ast', { get: () => {
      throw new Error('must never consume token')
    } })
    const warn = vi.fn()
    const ast = t.identifier('count')
    ast.start = 3
    ast.end = 8
    const options = { warn, [transferKey]: token, classStyleBindings: [{ name: 'cls', type: 'class' as const, exp: 'count', expAst: ast, forStack: [], conditions: [{ expAst: ast, rawExpAst: ast, forDepth: 0 }] }] }
    const input = { kind: 'live' as const, options, expressions, transferKey }
    const fromLive = buildTransformScriptRequest(input)
    const captured = serializeCaptureValue(options, { inputOptions: true, expressions, transferKey })
    const fromCapture = buildTransformScriptRequest({ kind: 'captured', options: captured })
    expect(fromLive).toEqual(fromCapture)
    const nodes = findExpressions(fromLive.options)
    expect(nodes.map(node => node.role)).toEqual(['expAst', 'expAst', 'rawExpAst'])
    expect(nodes.every(node => node.id === 1 && node.source === 'count' && node.nodeType === 'Identifier')).toBe(true)
    expect(decodeCapturedData(nodes[0].originalSpan)).toEqual({ start: 3, end: 8 })
    expect(fromLive.bridge).toMatchObject({ expressionCount: 3, generatedUtf16Chars: 15 })
    const json = serializeTransformScriptRequest(input)
    expect(json).not.toContain('ast-expression')
    expect(json).not.toContain('must never consume token')
    expect(json).toContain('existing baseline loader; never consumed')
    expect(json).toContain('caller; never transferred')
    expect(warn).not.toHaveBeenCalled()
    expect(options.warn).toBe(warn)
    expect(options[transferKey]).toBe(token)
    expect(options.classStyleBindings[0].expAst).toBe(ast)
  })

  it('rejects unknown options, unowned symbols, unknown callbacks and accessors', () => {
    expect(() => live({ unknown: true } as TransformScriptOptions)).toThrow('Unknown, duplicate or invalid request property')
    expect(() => live({ [Symbol('unknown')]: {} })).toThrow('Unknown symbol ownership')
    expect(() => live({ wevuDefaults: { app: { callback() {} } } })).toThrow('Unsupported function')
    const getter = vi.fn()
    expect(() => live(Object.defineProperty({}, 'isPage', { get: getter }))).toThrow('accessor')
    expect(getter).not.toHaveBeenCalled()
  })

  it('rejects conflicting expression identity and unbridged AST fields in persisted captures', () => {
    const ast = t.identifier('count')
    const captured = serializeCaptureValue({ classStyleBindings: [{ expAst: ast, rawExpAst: ast }] }, { inputOptions: true, expressions })
    findExpressions(captured)[1].generatedSource = 'other'
    expect(() => buildTransformScriptRequest({ kind: 'captured', options: captured })).toThrow('Conflicting expression identity')
    const unbridged = serializeCaptureValue({ classStyleBindings: [{ expAst: { type: 'Identifier', name: 'count' } }] })
    expect(() => buildTransformScriptRequest({ kind: 'captured', options: unbridged })).toThrow('was not bridged')
  })

  it('returns a detached contract so a consumer cannot mutate subsequent requests', () => {
    const request = live({})
    request.contract.runtime.apiModules.ref = 'mutated'
    expect(live({}).contract.runtime.apiModules.ref).toBe(resolveWevuInternalImportModuleId('ref'))
  })

  it('extracts the shared contract once per process and records initialization separately', () => {
    const request = live({})
    const before = scriptRequestContractSnapshot()
    live({ isApp: true })
    const after = scriptRequestContractSnapshot()
    expect(after).toEqual(before)
    expect(after).toMatchObject({ initialized: true, initialization: { sourceReads: 4, parseCalls: 5 }, extractedSources: request.contract.extractedSources })
    expect(after.initialization!.durationMs).toBeGreaterThanOrEqual(0)
    expect(request).not.toHaveProperty('initialization')
  })
})

describe('compiler-derived script contract', () => {
  it('uses constants and existing API routing instead of duplicated runtime marker values', () => {
    const contract = createScriptRequestContract()
    expect(contract.markers.WEVU_BINDING_MANIFEST_KEY).toBe(markers.WEVU_BINDING_MANIFEST_KEY)
    expect(contract.markers.WEVU_INLINE_MAP_KEY).toBe(markers.WEVU_INLINE_MAP_KEY)
    expect(contract.runtime.contractVersion).toBe(markers.WEAPP_VITE_RUNTIME_CONTRACT_VERSION)
    expect(contract.runtime.movableWevuImports).toContain('useTemplateRef')
    expect(contract.runtime.movedVueImports).toContain('useSlots')
    for (const [name, module] of Object.entries(contract.runtime.apiModules)) {
      expect(module).toBe(resolveWevuInternalImportModuleId(name))
    }
    expect(Object.keys(contract.runtime.installerLocalNames)).toEqual([...WE_VU_RUNTIME_CAPABILITY_ORDER])
  })

  it('extracts nested declarations without execution and binds exact source hashes', () => {
    const sources = staticSources()
    const contract = createScriptRequestContract(sources)
    expect(contract.runtime.movableWevuImports).toEqual(['ref', ...Object.values(WE_VU_RUNTIME_CAPABILITY_INSTALLERS)])
    expect(contract.runtime.movedVueImports).toEqual(['useSlots'])
    expect(contract.runtime.defaultOptionsIdentifier).toBe('syntheticOptions')
    expect(Object.values(contract.extractedSources)).toEqual(Object.values(sources).map(source => createHash('sha256').update(source).digest('hex')))
  })

  it.each(['missing', 'duplicate', 'computed', 'spread', 'empty'] as const)('rejects %s static Set declaration changes', (mode) => {
    const sources = staticSources()
    if (mode === 'missing') {
      sources.imports = sources.imports.replace('INTERNAL_RUNTIME_VALUE_EXPORTS', 'changed')
    }
    else if (mode === 'duplicate') {
      sources.imports += 'function other() { const INTERNAL_RUNTIME_VALUE_EXPORTS = new Set(["ref"]); }'
    }
    else if (mode === 'computed') {
      sources.imports = sources.imports.replace('\'ref\'', 'computeName()')
    }
    else if (mode === 'spread') {
      sources.imports = sources.imports.replace('...Object.values(WE_VU_RUNTIME_CAPABILITY_INSTALLERS)', '...unknown')
    }
    else {
      sources.imports = sources.imports.replace('[\'useSlots\']', '[]')
    }
    expect(() => createScriptRequestContract(sources)).toThrow('contract')
  })

  it.each(['missing', 'spread', 'expression'] as const)('rejects %s installer helper contract changes', (mode) => {
    const sources = staticSources()
    if (mode === 'missing') {
      sources.installers = sources.installers.replace('patchStrategy: \'local_patchStrategy\',', '')
    }
    else if (mode === 'spread') {
      sources.installers = sources.installers.replace('{', '{ ...other,')
    }
    else {
      sources.installers = sources.installers.replace('\'local_patchStrategy\'', 'getName()')
    }
    expect(() => createScriptRequestContract(sources)).toThrow()
  })
})
