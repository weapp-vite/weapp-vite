import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CorePluginState } from '../../../helpers'
import vm from 'node:vm'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { injectAppPreludeCode } from '../appPrelude'
import { APP_PRELUDE_REQUIRE_MARKER, REQUEST_GLOBAL_BUNDLE_MARKER, REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER } from '../constants'
import { injectRequestGlobalsAppRegistration, inlineRequestGlobalsAppRegisteredInstallerChunks } from '../requestGlobals'
import { collectRequestGlobalsInstallerDependencies } from './chunkGraph'

const installer = 'weapp-vendors/request-globals-web-apis-shared.js'
const support = 'weapp-vendors/support.js'
const leaf = 'common.js'

function chunk(fileName: string, code: string, imports: string[] = []): OutputChunk {
  return { type: 'chunk', fileName, code, imports, dynamicImports: [] } as unknown as OutputChunk
}

function execute(bundle: OutputBundle) {
  const context = vm.createContext({})
  const cache = new Map<string, { exports: Record<string, unknown> }>()
  const loads: string[] = []
  function load(file: string): Record<string, unknown> {
    const cached = cache.get(file)
    if (cached) {
      return cached.exports
    }
    const output = bundle[file]
    if (!output) {
      throw new Error(`Missing module ${file}`)
    }
    const module = { exports: {} }
    cache.set(file, module)
    loads.push(file)
    const source = output.type === 'chunk' ? output.code : String(output.source)
    const run = vm.runInContext(`(function(module, exports, require) {\n${source}\n})`, context, { filename: file })
    run(module, module.exports, (request: string) => load(path.posix.normalize(path.posix.join(path.posix.dirname(file), request))))
    return module.exports
  }
  load('app.js')
  const page = load('pages/index.js')
  return { context, loads, page }
}

function fixture(): OutputBundle {
  return {
    [installer]: chunk(installer, `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */
      globalThis.moduleInitializations = (globalThis.moduleInitializations || 0) + 1;
      const support = require('./support.js');
      exports.installWebRuntimeGlobals = () => {
        globalThis.installations = (globalThis.installations || 0) + 1;
        return { URL: support.URL };
      };`),
    [support]: chunk(support, `/* ${REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER} */
      exports.URL = require('../common.js').URL;`),
    [leaf]: chunk(leaf, `/* ${REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER} */
      exports.URL = class URL { constructor() { this.value = 'ready'; } };`),
    'axios.js': chunk('axios.js', `/* ${REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER} */
      const runtime = require('./${installer}'); exports.value = new URL().value;`),
    'app.js': chunk('app.js', `exports.value = require('./axios.js').value;`),
    'pages/index.js': chunk('pages/index.js', `exports.value = new URL().value;`),
  }
}

function inject(bundle: OutputBundle, userPrelude: string | undefined) {
  const installers = new Map([[installer, 'installWebRuntimeGlobals']])
  const state = { ctx: { scanService: { subPackageMap: new Map() } } } as unknown as CorePluginState
  injectRequestGlobalsAppRegistration(bundle, installers)
  const preserved = injectAppPreludeCode(bundle, userPrelude, { enabled: true, mode: 'require' }, state, {
    enabled: true,
    installerChunks: installers,
    mode: 'explicit',
    targets: ['URL'],
  }, (asset) => {
    bundle[asset.fileName] = asset as OutputBundle[string]
  })
  return { installers, preserved }
}

describe('request globals prelude initialization order', () => {
  it('initializes web globals before user prelude and keeps consumers behind the prelude', () => {
    const bundle = fixture()
    const { installers, preserved } = inject(bundle, `
      if (typeof URL !== 'function') throw new Error('web globals unavailable in user prelude');
      globalThis.preludeValue = new URL().value;`)
    inlineRequestGlobalsAppRegisteredInstallerChunks(bundle, installers, preserved)

    for (const file of [installer, support, leaf]) {
      expect((bundle[file] as OutputChunk).code).not.toContain(APP_PRELUDE_REQUIRE_MARKER)
    }
    for (const file of ['app.js', 'axios.js', 'pages/index.js']) {
      expect((bundle[file] as OutputChunk).code).toContain(APP_PRELUDE_REQUIRE_MARKER)
    }
    const result = execute(bundle)
    expect(result.page.value).toBe('ready')
    expect(result.context.preludeValue).toBe('ready')
    expect(result.context.moduleInitializations).toBe(1)
    expect(result.context.installations).toBe(1)
  })

  it.each(['set', 'asset'] as const)('retains one installer module when preservation comes from %s', (preservation) => {
    const bundle = fixture()
    const { installers, preserved } = inject(bundle, undefined)
    const prelude = bundle['app.prelude.js']!
    if (preservation === 'set') {
      // emitFile 发出的 asset 在 generateBundle 期间可能尚未加入 bundle。
      delete bundle['app.prelude.js']
    }
    inlineRequestGlobalsAppRegisteredInstallerChunks(bundle, installers, preservation === 'set' ? preserved : new Set())
    bundle['app.prelude.js'] = prelude
    expect(bundle[installer]).toBeDefined()
    const result = execute(bundle)
    expect(result.context.moduleInitializations).toBe(1)
    expect(result.loads.filter(file => file === installer)).toHaveLength(1)
  })

  it('collects metadata and emitted requires without treating strings or shadowed calls as edges', () => {
    const bundle: OutputBundle = {
      [installer]: chunk(installer, `require('./support.js');
        const text = "require('../unrelated.js')";
        (function(require) { require('../unrelated.js'); })(() => {});`, ['metadata.js']),
      [support]: chunk(support, `require('../common.js');`),
      [leaf]: chunk(leaf, ''),
      'metadata.js': chunk('metadata.js', ''),
      'unrelated.js': chunk('unrelated.js', ''),
    }
    expect([...collectRequestGlobalsInstallerDependencies(bundle, [installer])].sort()).toEqual([installer, support, leaf, 'metadata.js'].sort())
  })
})
