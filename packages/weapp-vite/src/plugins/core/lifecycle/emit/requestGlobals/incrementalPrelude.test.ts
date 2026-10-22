import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CorePluginState } from '../../../helpers'
import vm from 'node:vm'
import { REQUEST_GLOBAL_BUNDLE_MARKER } from '@weapp-core/constants'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { FULL_REQUEST_GLOBAL_TARGETS } from '../../../../../runtime/config/internal/injectRequestGlobals'
import { injectAppPreludeCode } from '../appPrelude'
import { injectRequestGlobalsBundleRuntime } from '../requestGlobals'

const installer = 'runtime.js'
const state = { ctx: { scanService: { subPackageMap: new Map() } } } as unknown as CorePluginState

function chunk(fileName: string, code: string): OutputChunk {
  return { type: 'chunk', fileName, code, imports: [], dynamicImports: [] } as unknown as OutputChunk
}

function fixture(): OutputBundle {
  return {
    [installer]: chunk(installer, `
      function installWebRuntimeGlobals(options = {}) {
        const targets = options.targets ?? ${JSON.stringify(FULL_REQUEST_GLOBAL_TARGETS)};
        globalThis.installations = (globalThis.installations || 0) + 1;
        return { AbortController: class AbortController { constructor() { this.signal = { aborted: false }; } } };
      }
      Object.defineProperty(exports, 'installWebRuntimeGlobals', { enumerable: true, get: function() { return installWebRuntimeGlobals; } });
    `),
    'app.js': chunk('app.js', `
      exports.beforeImports = typeof globalThis.AbortController;
      const runtime = require('./runtime.js');
      exports.aborted = new AbortController().signal.aborted;
    `),
    'components/unrelated.js': chunk('components/unrelated.js', `
      const runtime = require('../runtime.js');
      exports.marker = 'unchanged-component';
      exports.aborted = new AbortController().signal.aborted;
    `),
  }
}

function publish(bundle: OutputBundle, previous: OutputBundle = {}, pluginState = state) {
  const installers = injectRequestGlobalsBundleRuntime(bundle, ['AbortController'], 'explicit')
  const emitted: OutputBundle = {}
  injectAppPreludeCode(bundle, undefined, { enabled: true, mode: 'require' }, pluginState, {
    enabled: true,
    installerChunks: installers,
    mode: 'explicit',
    targets: ['AbortController'],
  }, (asset) => {
    emitted[asset.fileName] = asset as OutputBundle[string]
  })
  return { installers, publication: { ...previous, ...bundle, ...emitted } }
}

function execute(bundle: OutputBundle, root = '') {
  const context = vm.createContext({})
  const cache = new Map<string, { exports: Record<string, unknown> }>()
  function load(file: string): Record<string, unknown> {
    const cached = cache.get(file)
    if (cached) {
      return cached.exports
    }
    const output = bundle[file]
    if (!output) {
      throw new Error(`Missing emitted module: ${file}`)
    }
    const module = { exports: {} }
    cache.set(file, module)
    const source = output.type === 'chunk' ? output.code : String(output.source)
    const run = vm.runInContext(`(function(module, exports, require) {\n${source}\n})`, context, { filename: file })
    run(module, module.exports, (request: string) => load(path.posix.normalize(path.posix.join(path.posix.dirname(file), request))))
    return module.exports
  }
  const app = load(path.posix.join(root, 'app.js'))
  const component = load(path.posix.join(root, 'components/unrelated.js'))
  return { app, component }
}

describe('request globals ownership across classic compiler generations', () => {
  it('keeps installer discovery stable when the next generation reuses a transformed runtime chunk', () => {
    const bundle = fixture()
    const first = injectRequestGlobalsBundleRuntime(bundle, ['AbortController'], 'explicit')
    const code = (bundle[installer] as OutputChunk).code

    expect(first.get(installer)).toBe('installWebRuntimeGlobals')
    expect(injectRequestGlobalsBundleRuntime(bundle, ['AbortController'], 'explicit')).toEqual(first)
    expect((bundle[installer] as OutputChunk).code).toBe(code)
  })

  it('derives full and partial ownership from the current bundle without reviving a retired installer', () => {
    const bundle = fixture()
    const original = injectRequestGlobalsBundleRuntime(bundle, ['AbortController'], 'explicit')
    const partial = { 'components/unrelated.js': bundle['components/unrelated.js']! }
    expect(injectRequestGlobalsBundleRuntime(partial, ['AbortController'], 'explicit').size).toBe(0)
    expect(injectRequestGlobalsBundleRuntime(bundle, ['AbortController'], 'explicit')).toEqual(original)

    const retired = { [installer]: chunk(installer, `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */ exports.retired = 'installWebRuntimeGlobals';`) }
    expect(injectRequestGlobalsBundleRuntime(retired, ['AbortController'], 'explicit').size).toBe(0)
    expect(injectRequestGlobalsBundleRuntime(fixture(), ['AbortController'], 'explicit')).toEqual(original)
  })

  it('returns no ownership for empty helper targets and derives configuration from fresh compiler input', () => {
    const previous = publish(fixture())
    // 这里只验证 helper 的空输入；公开配置使用 enabled: false 关闭，不由 targets: [] 表达。
    expect(injectRequestGlobalsBundleRuntime(previous.publication, [], 'explicit').size).toBe(0)

    const restarted = fixture()
    const installers = injectRequestGlobalsBundleRuntime(restarted, ['AbortSignal'], 'explicit')
    const emitted: Record<string, string> = {}
    injectAppPreludeCode(restarted, undefined, { enabled: true, mode: 'require' }, state, {
      enabled: true,
      installerChunks: installers,
      mode: 'explicit',
      targets: ['AbortSignal'],
    }, asset => emitted[asset.fileName] = asset.source)
    expect(installers).toEqual(previous.installers)
    expect(emitted['app.prelude.js']).toContain('targets: ["AbortSignal"]')
    expect(emitted['app.prelude.js']).not.toContain('targets: ["AbortController"]')

    const sameConfigurationRestart = publish(fixture())
    expect(sameConfigurationRestart.installers).toEqual(previous.installers)
    expect(String((sameConfigurationRestart.publication['app.prelude.js'] as { source: string }).source))
      .toBe(String((previous.publication['app.prelude.js'] as { source: string }).source))
    expect(execute(sameConfigurationRestart.publication)).toEqual(execute(previous.publication))
  })

  it('keeps a usable prelude and unchanged component bytes through two later classic generations', () => {
    const first = publish(fixture())
    const initialPrelude = String((first.publication['app.prelude.js'] as { source: string }).source)
    const initialComponent = (first.publication['components/unrelated.js'] as OutputChunk).code
    const initialRuntime = execute(first.publication)
    expect(initialRuntime.app).toMatchObject({ beforeImports: 'function', aborted: false })
    expect(initialRuntime.component).toMatchObject({ marker: 'unchanged-component', aborted: false })

    let previous = first.publication
    for (const generation of [2, 3]) {
      // classic 的局部发布会复用已完成后处理的 chunk；asset 则由本轮 emitFile 发布。
      const chunks = Object.fromEntries(Object.entries(previous)
        .filter(([, output]) => output.type === 'chunk')
        .map(([file, output]) => [file, { ...output }])) as OutputBundle
      const next = publish(chunks, previous)
      expect.soft(next.installers, `generation ${generation} retains installer ownership`).toEqual(first.installers)
      expect.soft(String((next.publication['app.prelude.js'] as { source: string }).source), `generation ${generation} preserves the executable prelude`).toBe(initialPrelude)
      expect.soft((next.publication['components/unrelated.js'] as OutputChunk).code, `generation ${generation} does not rewrite an unrelated component`).toBe(initialComponent)
      expect.soft(execute(next.publication), `generation ${generation} installs globals before app initialization`).toEqual(initialRuntime)
      previous = next.publication
    }
  })

  it('derives independent prelude dependencies only from its own current native chunks', () => {
    const root = 'subpackages/standalone'
    const pluginState = { ...state, subPackageMeta: { subPackage: { root, independent: true } } } as CorePluginState
    const independent = () => Object.fromEntries(Object.values(fixture()).map(output => [
      `${root}/${output.fileName}`,
      { ...output, fileName: `${root}/${output.fileName}` },
    ])) as OutputBundle
    const first = publish(independent(), {}, pluginState)
    const preludeFile = `${root}/app.prelude.js`
    const prelude = String((first.publication[preludeFile] as { source: string }).source)
    expect(prelude).toContain('require("./runtime.js")')
    expect(first.publication['app.prelude.js']).toBeUndefined()
    const runtime = execute(first.publication, root)
    expect(runtime.app).toMatchObject({ beforeImports: 'function', aborted: false })

    const chunks = Object.fromEntries(Object.entries(first.publication)
      .filter(([, output]) => output.type === 'chunk')
      .map(([file, output]) => [file, { ...output }])) as OutputBundle
    const next = publish(chunks, first.publication, pluginState)
    expect(String((next.publication[preludeFile] as { source: string }).source)).toBe(prelude)
    expect(execute(next.publication, root)).toEqual(runtime)

    const retired = publish({
      [`${root}/app.js`]: chunk(`${root}/app.js`, 'exports.retired = true;'),
    }, {}, pluginState)
    expect(retired.installers.size).toBe(0)
    expect(String((retired.publication[preludeFile] as { source: string }).source)).not.toContain('runtime.js')
  })
})
