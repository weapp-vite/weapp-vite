import type { NativeScriptAnalysis } from './native'
import type { ScriptAnalysisOptions } from './operations/scriptAnalysis'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./operations/internal/scriptAnalysis', async (original) => {
  const module = await original<typeof import('./operations/internal/scriptAnalysis')>()
  const service = module.jsScriptAnalysisService
  return {
    jsScriptAnalysisService: {
      collectFeatureFlags: vi.fn(service.collectFeatureFlags),
      mayContainPlatformApiAccess: vi.fn(service.mayContainPlatformApiAccess),
      mayContainStaticRequireLiteral: vi.fn(service.mayContainStaticRequireLiteral),
    },
  }
})

interface BindingCalls {
  batch: number
  single: number
  feature: number
  platform: number
  require: number
}

interface FixtureBinding {
  calls: BindingCalls
  rawSummary?: NativeScriptAnalysis
  featureReads?: number
}

let fixtureDirectory: string | undefined

async function fixture(batchBody?: string, singleBody = 'throw new Error("single native failure")') {
  fixtureDirectory = await mkdtemp(join(tmpdir(), 'ast-native-fallback-'))
  const filename = join(fixtureDirectory, 'binding.cjs')
  await writeFile(filename, `
const calls = { batch: 0, single: 0, feature: 0, platform: 0, require: 0 };
exports.calls = calls;
const summary = input => ({
  hasStaticRequireLiteral: input.code.includes('require('),
  hasPlatformApiAccess: input.code.includes('wx.'),
  featureFlags: input.code.includes('wevu') ? ['scroll'] : [],
});
${batchBody === undefined ? '' : `exports.analyzeScriptsNative = inputs => { calls.batch++; ${batchBody} };`}
exports.analyzeScriptNative = () => { calls.single++; ${singleBody} };
exports.collectFeatureFlagsNative = () => { calls.feature++; throw new Error('unexpected feature retry'); };
exports.mayContainPlatformApiAccessNative = () => { calls.platform++; throw new Error('unexpected platform retry'); };
exports.mayContainStaticRequireLiteralNative = () => { calls.require++; throw new Error('unexpected require retry'); };
`)
  vi.stubEnv('WEAPP_VITE_NATIVE', '1')
  vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', filename)
  vi.resetModules()
  vi.clearAllMocks()
  const ast = await import('./index')
  const native = await import('./native')
  const observation = await import('./native/observation')
  const { jsScriptAnalysisService: service } = await import('./operations/internal/scriptAnalysis')
  const features = await import('./operations/featureFlags')
  const platform = await import('./operations/platformApi')
  const requires = await import('./operations/require')
  const binding = native.loadNativeAstBindingSync() as unknown as FixtureBinding
  return { ast, native, observation, service, features, platform, requires, binding, calls: binding.calls }
}

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.clearAllMocks()
  if (fixtureDirectory) {
    await rm(fixtureDirectory, { recursive: true, force: true })
    fixtureDirectory = undefined
  }
})

const inputs = [
  { code: 'import { onPageScroll as scroll } from "wevu"; scroll(() => {}); require("dep"); wx.request()', filename: 'page.ts' },
  { code: 'const value = 1', filename: 'other.ts' },
]
const options: ScriptAnalysisOptions<'scroll'> = {
  engine: 'oxc',
  featureFlags: { astEngine: 'oxc', moduleId: 'wevu', hookToFeature: { onPageScroll: 'scroll' } },
}

function assertNoLeafRetries(calls: BindingCalls) {
  expect(calls).toMatchObject({ single: 0, feature: 0, platform: 0, require: 0 })
}

function assertJsCalls(context: Awaited<ReturnType<typeof fixture>>, count: number) {
  expect(context.service.collectFeatureFlags).toHaveBeenCalledTimes(count)
  expect(context.service.mayContainPlatformApiAccess).toHaveBeenCalledTimes(count)
  expect(context.service.mayContainStaticRequireLiteral).toHaveBeenCalledTimes(count)
}

function jsBaseline(context: Awaited<ReturnType<typeof fixture>>, engine: 'babel' | 'oxc') {
  const previousNative = process.env.WEAPP_VITE_NATIVE
  vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  try {
    return inputs.map(input => ({
      featureFlags: context.features.collectFeatureFlagsFromCode(input.code, options.featureFlags!),
      hasPlatformApiAccess: context.platform.mayContainPlatformApiAccess(input.code, { engine }),
      hasStaticRequireLiteral: context.requires.mayContainStaticRequireLiteral(input.code, { engine }),
    }))
  }
  finally {
    vi.stubEnv('WEAPP_VITE_NATIVE', previousNative)
    vi.clearAllMocks()
  }
}

describe('script native failure ownership', () => {
  it.each(['babel', 'oxc'] as const)('runs each complete %s fallback once after a failed batch', async (engine) => {
    const context = await fixture('throw new Error("batch failure")')
    const expected = jsBaseline(context, engine)
    const selectedNativePath = process.env.WEAPP_VITE_NATIVE_AST_PATH
    const { value, stats } = await context.observation.observeNativeAnalysis(() => context.ast.analyzeScripts(inputs, { ...options, engine }))

    expect(value).toEqual(expected)
    expect(context.calls.batch).toBe(1)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, inputs.length)
    expect(stats).toMatchObject({ bindingCalls: 1, batchCalls: 1, inputScripts: inputs.length })
    expect(process.env.WEAPP_VITE_NATIVE).toBe('1')
    expect(process.env.WEAPP_VITE_NATIVE_AST_PATH).toBe(selectedNativePath)
  })

  it.each(['return null', 'return []', 'return {}', 'return [summary(inputs[0])]'])('falls back once for malformed batch shape: %s', async (body) => {
    const context = await fixture(body)
    const expected = jsBaseline(context, 'oxc')
    expect(context.ast.analyzeScripts(inputs, options)).toEqual(expected)
    expect(context.calls.batch).toBe(1)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, inputs.length)
  })

  it.each([
    'return new Proxy(inputs.map(summary), { get(target, key, receiver) { if (key === "length") throw new Error("bad length"); return Reflect.get(target, key, receiver); } })',
    'const { proxy, revoke } = Proxy.revocable(inputs.map(summary), {}); revoke(); return proxy',
  ])('records batch shape validation failure once: %s', async (body) => {
    const context = await fixture(body)
    const expected = jsBaseline(context, 'oxc')
    const { value, stats } = await context.observation.observeNativeAnalysis(() => context.ast.analyzeScripts(inputs, options))

    expect(value).toEqual(expected)
    expect(context.calls.batch).toBe(1)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, inputs.length)
    expect(stats).toMatchObject({ bindingCalls: 1, batchCalls: 1, fallbacks: 1 })
    expect(context.native.getCachedNativeOnPageScrollDiagnostics(inputs[1]!.code, inputs[1]!.filename)).toBeUndefined()
  })

  it('keeps valid neighbors, rejects a malformed last item before caching and falls back only that item', async () => {
    const context = await fixture(`return [summary(inputs[0]), {
      ...summary(inputs[1]), featureFlags: [null],
      onPageScrollDiagnostics: [{ kind: 'empty', line: 1, column: 0, sourceLabel: 'scroll' }],
    }]`)
    const expected = jsBaseline(context, 'oxc')
    const { value, stats } = await context.observation.observeNativeAnalysis(() => context.ast.analyzeScripts(inputs, options))
    expect(value).toEqual(expected)
    expect(context.calls.batch).toBe(1)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, 1)
    expect(context.native.getCachedNativeOnPageScrollDiagnostics(inputs[1]!.code, inputs[1]!.filename)).toBeUndefined()
    expect(stats).toMatchObject({ bindingCalls: 1, batchCalls: 1, fallbacks: 1 })
  })

  it.each([
    'const sparse = ["scroll", , "scroll"]; return [{ ...summary(inputs[0]), featureFlags: sparse }, summary(inputs[1])]',
    'const bad = summary(inputs[0]); Object.defineProperty(bad, "featureFlags", { get() { throw new Error("bad getter") } }); return [bad, summary(inputs[1])]',
    'const results = [summary(inputs[0]), summary(inputs[1])]; Object.defineProperty(results, 0, { get() { throw new Error("bad slot getter") } }); return results',
  ])('rejects unavailable summary entries without retrying native: %s', async (body) => {
    const context = await fixture(body)
    const expected = jsBaseline(context, 'oxc')
    expect(context.ast.analyzeScripts(inputs, options)).toEqual(expected)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, 1)
  })

  it('reads a summary getter once and consumes indexed copies of features', async () => {
    const context = await fixture(`
      const results = inputs.map(summary);
      const flags = results[0].featureFlags;
      flags[Symbol.iterator] = () => { throw new Error('binding iterator must not be used'); };
      exports.featureReads = 0;
      Object.defineProperty(results[0], 'featureFlags', { get() {
        if (++exports.featureReads > 1) throw new Error('getter was read again');
        return flags;
      } });
      return results;
    `)
    const expected = jsBaseline(context, 'oxc')
    expect(context.ast.analyzeScripts(inputs, options)).toEqual(expected)
    expect(context.binding.featureReads).toBe(1)
    expect(context.calls.batch).toBe(1)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, 0)
  })

  it('owns cached summary arrays and diagnostic fields after the binding mutates its result', async () => {
    const context = await fixture(`
      const results = inputs.map(summary);
      results[1].onPageScrollDiagnostics = [{ kind: 'empty', line: 1, column: 0, sourceLabel: 'scroll' }];
      exports.rawSummary = results[1];
      return results;
    `)
    const result = context.native.analyzeScriptsWithNative(inputs)!
    const raw = context.binding.rawSummary!
    const diagnostic = { kind: 'empty', line: 1, column: 0, sourceLabel: 'scroll' }
    expect(result[1]).not.toBe(raw)
    raw.hasStaticRequireLiteral = true
    raw.hasPlatformApiAccess = true
    raw.featureFlags.push('changed')
    raw.onPageScrollDiagnostics![0]!.line = 0
    raw.onPageScrollDiagnostics![0]!.sourceLabel = 'changed'
    expect(result[1]).toEqual({
      hasStaticRequireLiteral: false,
      hasPlatformApiAccess: false,
      featureFlags: [],
      onPageScrollDiagnostics: [diagnostic],
    })
    expect(context.native.getCachedNativeOnPageScrollDiagnostics(inputs[1]!.code, inputs[1]!.filename)).toEqual([diagnostic])
    expect(context.native.analyzeScriptWithNative(inputs[1]!.code, { filename: inputs[1]!.filename })).toEqual(result[1])
    expect(context.calls.batch).toBe(1)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, 0)
  })

  it.each(['[{ kind: "empty", line: 0, column: 0, sourceLabel: "scroll" }]', 'new Array(1)'])('rejects incomplete diagnostics before caching: %s', async (diagnostics) => {
    const context = await fixture(`return [summary(inputs[0]), { ...summary(inputs[1]), onPageScrollDiagnostics: ${diagnostics} }]`)
    const expected = jsBaseline(context, 'oxc')
    expect(context.ast.analyzeScripts(inputs, options)).toEqual(expected)
    expect(context.native.getCachedNativeOnPageScrollDiagnostics(inputs[1]!.code, inputs[1]!.filename)).toBeUndefined()
    expect(context.calls.batch).toBe(1)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, 1)
  })

  it('uses the JS service when a legacy binding lacks batch support', async () => {
    const context = await fixture()
    const expected = jsBaseline(context, 'oxc')
    expect(context.ast.analyzeScripts(inputs, options)).toEqual(expected)
    expect(context.calls.batch).toBe(0)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, inputs.length)
  })

  it('keeps a failed single operation out of all leaf native entries', async () => {
    const context = await fixture()
    const expected = jsBaseline(context, 'oxc')[0]
    const { value, stats } = await context.observation.observeNativeAnalysis(() => context.ast.analyzeScript(inputs[0]!.code, options))
    expect(value).toEqual(expected)
    expect(context.calls).toEqual({ batch: 0, single: 1, feature: 0, platform: 0, require: 0 })
    assertJsCalls(context, 1)
    expect(stats).toMatchObject({ bindingCalls: 1, batchCalls: 0, inputScripts: 1 })
  })

  it('lets a JS failure propagate without running that fallback again', async () => {
    const context = await fixture('throw new Error("batch failure")')
    vi.mocked(context.service.mayContainPlatformApiAccess).mockImplementationOnce(() => {
      throw new Error('JS failure')
    })
    expect(() => context.ast.analyzeScripts(inputs, options)).toThrow('JS failure')
    expect(context.calls.batch).toBe(1)
    assertNoLeafRetries(context.calls)
    expect(context.service.collectFeatureFlags).toHaveBeenCalledTimes(1)
    expect(context.service.mayContainPlatformApiAccess).toHaveBeenCalledTimes(1)
    expect(context.service.mayContainStaticRequireLiteral).not.toHaveBeenCalled()
  })

  it('keeps native-off and empty batch calls cold', async () => {
    const context = await fixture('return inputs.map(summary)')
    expect(context.ast.analyzeScripts([], options)).toEqual([])
    expect(context.calls.batch).toBe(0)
    assertJsCalls(context, 0)
    const expected = jsBaseline(context, 'oxc')
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
    const { value, stats } = await context.observation.observeNativeAnalysis(() => context.ast.analyzeScripts(inputs, options))
    expect(value).toEqual(expected)
    expect(context.calls.batch).toBe(0)
    assertNoLeafRetries(context.calls)
    assertJsCalls(context, inputs.length)
    expect(stats).toMatchObject({ bindingCalls: 0, batchCalls: 0, inputScripts: 0, loadFailures: 0 })
  })
})
