import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CorePluginState } from '../../../helpers'
import type { RequestGlobalsAnalysisOptions } from './analysis'
import { REQUEST_GLOBAL_INSTALLER_MARKER } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FULL_REQUEST_GLOBAL_TARGETS, resolveAutoRequestGlobalsTargets } from '../../../../../runtime/config/internal/injectRequestGlobals'
import { parseJsLike, traverse } from '../../../../../utils/babel'
import { injectAppPreludeCode } from '../appPrelude'
import { collectNativePublicationDependencies } from '../nativePublicationDependencies'
import {
  injectRequestGlobalsAppRegistration,
  injectRequestGlobalsBundleRuntime,
  injectRequestGlobalsLocalBindings,
  injectRequestGlobalsPassiveBindings,
  resolveRequestGlobalsExportName,
  resolveRequestGlobalsInstallerImport,
  resolveRequestGlobalsInstallerName,
} from '../requestGlobals'
import { getSessionRequestGlobalsAnalysisCache, RequestGlobalsAnalysisCache } from './analysis'
import { collectTopLevelDeclaredIdentifiers } from './bindings'
import { collectRequestGlobalsInstallerDependencies } from './chunkGraph'

vi.mock('../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../utils/babel')>()
  return { ...actual, parseJsLike: vi.fn(actual.parseJsLike), traverse: vi.fn(actual.traverse) }
})

const installer = `function install() { return { fetch() { return 'ready'; } }; }
Object.defineProperty(install, ${JSON.stringify(REQUEST_GLOBAL_INSTALLER_MARKER)}, { value: true });
Object.defineProperty(exports, 'installWebRuntimeGlobals', { get() { return install; } });`

function chunk(fileName: string, code: string, imports: string[] = []): OutputChunk {
  return { type: 'chunk', fileName, code, imports, dynamicImports: [] } as unknown as OutputChunk
}

function options(cache = new RequestGlobalsAnalysisCache()): RequestGlobalsAnalysisOptions {
  return { cache, astEngine: 'babel', profile: {} }
}

describe('request globals content analysis', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shares one parse and traversal across installer, export, binding, usage and import discovery', () => {
    const code = `${installer}\nimport { value } from './support.js'; const { URL } = source; function local(fetch) { return fetch(); } fetch('/probe'); require('./leaf.js');`
    const analysis = options()
    const facts = analysis.cache.get(code, 'main.js', analysis)!
    expect(resolveRequestGlobalsInstallerName(code, analysis, 'main.js')).toBe('install')
    expect(resolveRequestGlobalsExportName(code, 'install', analysis, 'main.js')).toBe('installWebRuntimeGlobals')
    expect(resolveRequestGlobalsInstallerImport(chunk('main.js', code), new Map([['support.js', 'install']]), analysis)).toEqual({ installerChunkFileName: 'support.js', exportName: 'install' })
    expect(facts.declaredIdentifiers).toContain('URL')
    expect(facts.requires).toEqual(['./leaf.js'])
    expect(facts.usage?.referencedTargets).toContain('fetch')
    expect(facts.usage?.referencedTargets).not.toContain('URL')
    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(traverse).toHaveBeenCalledTimes(1)
    expect(facts.declaredIdentifiers).toEqual([...collectTopLevelDeclaredIdentifiers(code)])
  })

  it.each([
    'function local(fetch) { return fetch(); } exports.ready = true;',
    'const { fetch } = source; fetch();',
    'function local() { var Headers; return Headers; } exports.headers = new Headers();',
    'import query from "graphql-request"; exports.query = query;',
    'exports.socket = "websocket";',
    'exports.ready = true;',
  ])('matches original auto selection for restricted targets in %s', (code) => {
    const facts = options().cache.get(code, 'main.js')!
    for (const targets of [FULL_REQUEST_GLOBAL_TARGETS, ['fetch'] as const, ['Headers'] as const, ['WebSocket'] as const]) {
      expect(resolveAutoRequestGlobalsTargets(code, targets, facts.usage)).toEqual(resolveAutoRequestGlobalsTargets(code, targets))
    }
  })

  it('keeps escaped markers and renamed public exports in the batch traversal', () => {
    const escaped = REQUEST_GLOBAL_INSTALLER_MARKER.split('').map(value => `\\u${value.charCodeAt(0).toString(16).padStart(4, '0')}`).join('')
    const code = `const key = "${escaped}"; function renamed() {} renamed[key] = true; exports.installWebRuntimeGlobals = renamed;`
    expect(options().cache.get(code, 'runtime.js')?.installerName).toBe('renamed')
  })

  it('reuses A after B and never retains a retired installer or changed free binding', () => {
    const cache = new RequestGlobalsAnalysisCache()
    const a = cache.get(installer, 'runtime.js')
    expect(cache.get('const fetch = local; exports.ready = fetch;', 'runtime.js')?.installerName).toBeNull()
    expect(cache.get(installer, 'runtime.js')).toBe(a)
    expect(parseJsLike).toHaveBeenCalledTimes(2)
  })

  it('separates filename, engine, session and configuration identities', () => {
    const session = {}
    const config = {}
    const cache = getSessionRequestGlobalsAnalysisCache(session, config)
    expect(getSessionRequestGlobalsAnalysisCache(session, config)).toBe(cache)
    expect(getSessionRequestGlobalsAnalysisCache({}, config)).not.toBe(cache)
    expect(getSessionRequestGlobalsAnalysisCache(session, {})).not.toBe(cache)
    cache.get(installer, 'runtime.js', { astEngine: 'babel' })
    cache.get(installer, 'runtime.mjs', { astEngine: 'babel' })
    cache.get(installer, 'runtime.js', { astEngine: 'oxc' })
    expect(parseJsLike).toHaveBeenCalledTimes(3)
  })

  it('reuses unchanged content across snapshots of one source config and isolates reconfiguration and roots', () => {
    const session = {}
    const sourceConfig = {}
    const snapshot = (source = sourceConfig, overrides = {}) => ({
      options: { sourceConfig: source },
      cwd: 'project',
      absoluteSrcRoot: 'src',
      platform: 'weapp',
      isDev: true,
      ...overrides,
    })
    const owner = getSessionRequestGlobalsAnalysisCache(session, snapshot())
    const facts = owner.get(installer, 'runtime.js')
    const next = getSessionRequestGlobalsAnalysisCache(session, snapshot())
    expect(next).toBe(owner)
    expect(next.get(installer, 'runtime.js')).toBe(facts)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
    for (const config of [
      snapshot({}),
      snapshot(sourceConfig, { cwd: 'other' }),
      snapshot(sourceConfig, { absoluteSrcRoot: 'plugin' }),
      snapshot(sourceConfig, { platform: 'alipay' }),
      snapshot(sourceConfig, { isDev: false }),
    ]) {
      const separate = getSessionRequestGlobalsAnalysisCache(session, config)
      expect(separate).not.toBe(owner)
      expect(separate.get(installer, 'runtime.js')).not.toBe(facts)
    }
    expect(parseJsLike).toHaveBeenCalledTimes(6)
  })

  it('bounds root scopes without retaining each dynamic source root', () => {
    const session = {}
    const sourceConfig = {}
    const config = (index: number) => ({ options: { sourceConfig }, absoluteSrcRoot: `src-${index}` })
    const first = getSessionRequestGlobalsAnalysisCache(session, config(0))
    for (let index = 1; index <= 8; index += 1) {
      getSessionRequestGlobalsAnalysisCache(session, config(index))
    }
    expect(getSessionRequestGlobalsAnalysisCache(session, config(0))).not.toBe(first)
  })

  it('bounds memory and falls back after unsupported parsing instead of storing incorrect negative facts', () => {
    const cache = new RequestGlobalsAnalysisCache(1)
    cache.get(installer, 'runtime.js')
    cache.get('exports.value = true;', 'other.js')
    cache.get(installer, 'runtime.js')
    expect(parseJsLike).toHaveBeenCalledTimes(3)
    const oversized = new RequestGlobalsAnalysisCache(2, 1)
    oversized.get(installer, 'runtime.js')
    oversized.get(installer, 'runtime.js')
    expect(parseJsLike).toHaveBeenCalledTimes(5)
    const sharedRoot = new RequestGlobalsAnalysisCache(1)
    sharedRoot.forScope(1).get(installer, 'runtime.js')
    sharedRoot.forScope(2).get(installer, 'runtime.js')
    sharedRoot.forScope(1).get(installer, 'runtime.js')
    expect(parseJsLike).toHaveBeenCalledTimes(8)
    const analysis = options()
    expect(analysis.cache.get('const =', 'invalid.js')).toBeUndefined()
    expect(resolveRequestGlobalsInstallerName('const =', analysis, 'invalid.js')).toBe(resolveRequestGlobalsInstallerName('const ='))
  })

  it('resolves current installer maps and imports rather than caching a prior graph', () => {
    const analysis = options()
    const output = chunk('main.js', 'import runtime from "./runtime.js";')
    expect(resolveRequestGlobalsInstallerImport(output, new Map([['runtime.js', 'first']]), analysis)?.exportName).toBe('first')
    expect(resolveRequestGlobalsInstallerImport(output, new Map([['runtime.js', 'second']]), analysis)?.exportName).toBe('second')
    expect(resolveRequestGlobalsInstallerImport(output, new Map(), analysis)).toBeNull()
    const runtime = chunk('runtime.js', `${installer}\nrequire('./leaf.js'); function local(require) { require('./unowned.js'); }`, ['first.js'])
    const bundle: OutputBundle = { 'runtime.js': runtime, 'first.js': chunk('first.js', ''), 'second.js': chunk('second.js', ''), 'leaf.js': chunk('leaf.js', '') }
    expect([...collectRequestGlobalsInstallerDependencies(bundle, ['runtime.js'], analysis)].sort()).toEqual(['first.js', 'leaf.js', 'runtime.js'])
    runtime.imports = ['second.js']
    expect([...collectRequestGlobalsInstallerDependencies(bundle, ['runtime.js'], analysis)].sort()).toEqual(['leaf.js', 'runtime.js', 'second.js'])
    runtime.imports = []
    expect(collectNativePublicationDependencies(bundle, { rootFileName: 'app.js', requestGlobalsPrelude: true, analysis })).toEqual(new Set(['runtime.js']))
    runtime.imports = ['second.js']
    expect(collectNativePublicationDependencies(bundle, { rootFileName: 'app.js', requestGlobalsPrelude: true, analysis })).toEqual(new Set(['runtime.js', 'second.js']))
  })

  it.each(['auto', 'explicit'] as const)('keeps emitted injection and require-prelude bytes identical to the original path in %s mode', (mode) => {
    function emit(analysis?: RequestGlobalsAnalysisOptions) {
      const bundle: OutputBundle = {
        'app.js': chunk('app.js', 'exports.ready = true;'),
        'runtime.js': chunk('runtime.js', installer),
        'vendor.js': chunk('vendor.js', 'exports.request = () => fetch("/vendor");'),
        'pages/index.js': chunk('pages/index.js', 'const runtime = require("../runtime.js"); exports.ready = fetch("/page");', ['runtime.js']),
        'pages/shadowed.js': chunk('pages/shadowed.js', 'const { fetch } = source; exports.ready = fetch();'),
      }
      const entries = new Map([['app', { type: 'app' }], ['pages/index', { type: 'page' }], ['pages/shadowed', { type: 'page' }]])
      const installers = injectRequestGlobalsBundleRuntime(bundle, ['fetch'], mode, undefined, analysis)
      injectRequestGlobalsPassiveBindings(bundle, installers, ['fetch'], mode, entries, analysis)
      injectRequestGlobalsLocalBindings(bundle, installers, ['fetch'], mode, entries, undefined, analysis)
      injectRequestGlobalsAppRegistration(bundle, installers)
      const state = { ctx: { scanService: { subPackageMap: new Map() } } } as unknown as CorePluginState
      injectAppPreludeCode(bundle, undefined, { enabled: true, mode: 'require' }, state, { enabled: true, installerChunks: installers, mode, targets: ['fetch'] }, (asset) => {
        bundle[asset.fileName] = asset as OutputBundle[string]
      }, analysis)
      return Object.fromEntries(Object.entries(bundle).map(([name, output]) => [name, output.type === 'chunk' ? output.code : output.source]))
    }
    const analysis = options()
    expect(emit(analysis)).toEqual(emit())
    const firstParses = vi.mocked(parseJsLike).mock.calls.length
    emit(analysis)
    expect(vi.mocked(parseJsLike).mock.calls.length).toBe(firstParses)
  })
})
