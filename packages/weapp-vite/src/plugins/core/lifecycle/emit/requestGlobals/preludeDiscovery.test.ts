import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CorePluginState } from '../../../helpers'
import vm from 'node:vm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseJsLike } from '../../../../../utils/babel'
import { injectAppPreludeCode } from '../appPrelude'
import {
  APP_PRELUDE_REQUIRE_MARKER,
  REQUEST_GLOBAL_BUNDLE_MARKER,
  REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
  REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER,
} from '../constants'

vi.mock('../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../utils/babel')>()
  return { ...actual, parseJsLike: vi.fn(actual.parseJsLike) }
})

function chunk(fileName: string, code: string): OutputChunk {
  return { type: 'chunk', fileName, code, imports: [], dynamicImports: [] } as unknown as OutputChunk
}

function inject(output: OutputChunk, options: { enabled?: boolean, installers?: Map<string, string>, extra?: OutputBundle } = {}) {
  const bundle: OutputBundle = {
    ...options.extra,
    [output.fileName]: output,
    // 已有 asset 隔离消费者判断，避免把创建 prelude 自身的解析混入断言。
    'app.prelude.js': { type: 'asset', fileName: 'app.prelude.js', source: 'globalThis.preludeReady = true;' } as OutputBundle[string],
  }
  const state = { ctx: { scanService: { subPackageMap: new Map() } } } as unknown as CorePluginState
  injectAppPreludeCode(bundle, undefined, { enabled: true, mode: 'require' }, state, {
    enabled: options.enabled ?? true,
    installerChunks: options.installers ?? new Map(),
    mode: 'explicit',
    targets: ['URL'],
  })
  return bundle
}

function execute(output: OutputChunk, bundle: OutputBundle) {
  const context = vm.createContext({})
  const loaded: string[] = []
  const run = vm.runInContext(`(function(exports, require) {\n${output.code}\n})`, context)
  const exports: Record<string, unknown> = {}
  run(exports, (request: string) => {
    loaded.push(request)
    if (request !== './app.prelude.js') {
      throw new Error(`Unexpected module ${request}`)
    }
    vm.runInContext(String((bundle['app.prelude.js'] as { source: string }).source), context)
  })
  return { exports, loaded }
}

describe('request globals prelude dependency discovery', () => {
  beforeEach(() => {
    vi.mocked(parseJsLike).mockClear()
  })

  it.each([
    REQUEST_GLOBAL_BUNDLE_MARKER,
    REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER,
    REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER,
  ])('uses marker %s without parsing the consumer and executes its prelude first', (marker) => {
    const output = chunk('consumer.js', `/* ${marker} */ exports.ready = globalThis.preludeReady === true;`)
    const bundle = inject(output)

    expect(output.code).toContain(APP_PRELUDE_REQUIRE_MARKER)
    expect(parseJsLike).not.toHaveBeenCalled()
    expect(execute(output, bundle)).toEqual({ exports: { ready: true }, loaded: ['./app.prelude.js'] })

    const once = output.code
    inject(output)
    expect(output.code).toBe(once)
    expect(parseJsLike).not.toHaveBeenCalled()
  })

  it('keeps an unrelated unmarked consumer unchanged after checking its module syntax', () => {
    const code = 'exports.ready = true;'
    const output = chunk('consumer.js', code)
    inject(output)

    expect(output.code).toBe(code)
    expect(vi.mocked(parseJsLike).mock.calls.filter(([input]) => input === code)).toHaveLength(1)
  })

  it('retains AST discovery for an unmarked ESM import of the current installer', () => {
    const code = 'import { installWebRuntimeGlobals as install } from "./runtime.js"; export const ready = true;'
    const output = chunk('consumer.js', code)
    inject(output, {
      installers: new Map([['runtime.js', 'installWebRuntimeGlobals']]),
      extra: { 'runtime.js': chunk('runtime.js', 'exports.installWebRuntimeGlobals = () => ({});') },
    })

    expect(output.code).toContain(APP_PRELUDE_REQUIRE_MARKER)
    expect(output.code).toContain(code)
    expect(vi.mocked(parseJsLike).mock.calls.filter(([input]) => input === code)).toHaveLength(1)
  })

  it('keeps marked installer dependencies ahead of the prelude and respects disabled request globals', () => {
    const support = chunk('support.js', `/* ${REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER} */ exports.ready = true;`)
    const output = chunk('consumer.js', `/* ${REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER} */ exports.ready = true;`)
    inject(output, {
      installers: new Map([['runtime.js', 'installWebRuntimeGlobals']]),
      extra: {
        'runtime.js': chunk('runtime.js', 'require("./support.js"); exports.installWebRuntimeGlobals = () => ({});'),
        'support.js': support,
      },
    })
    expect(support.code).not.toContain(APP_PRELUDE_REQUIRE_MARKER)
    expect(output.code).toContain(APP_PRELUDE_REQUIRE_MARKER)

    vi.mocked(parseJsLike).mockClear()
    const disabled = chunk('disabled.js', `/* ${REQUEST_GLOBAL_LOCAL_BINDINGS_MARKER} */ exports.ready = true;`)
    const code = disabled.code
    inject(disabled, { enabled: false })
    expect(disabled.code).toBe(code)
    expect(parseJsLike).not.toHaveBeenCalled()
  })
})
