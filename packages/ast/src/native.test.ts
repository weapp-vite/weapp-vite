import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fixture = `
exports.analyzeScriptNative = (code, moduleId, mapping) => {
  if (code.includes('failNative')) throw new Error('native parsing failed')
  return {
    featureFlags: mapping ? Object.values(JSON.parse(mapping)) : [],
    hasPlatformApiAccess: code.includes('wx.'),
    hasStaticRequireLiteral: code.includes('require('),
    onPageScrollDiagnostics: code.includes('onPageScroll')
      ? [{ kind: 'empty', line: 1, column: 14, sourceLabel: 'onPageScroll(...)' }]
      : undefined,
  }
}
exports.analyzeScriptsNative = (inputs) => inputs.map(input =>
  exports.analyzeScriptNative(input.code, input.moduleId, input.hookToFeatureJson))
exports.collectOnPageScrollDiagnosticsNative = (code) => {
  if (code.includes('failNative')) throw new Error('native parsing failed')
  return [{ kind: 'empty', line: 1, column: 14, sourceLabel: 'onPageScroll(...)' }]
}
`

let fixtureDirectory: string | undefined

async function loadFixture(source = fixture) {
  fixtureDirectory = await mkdtemp(join(tmpdir(), 'ast-native-analysis-'))
  const modulePath = join(fixtureDirectory, 'binding.cjs')
  await writeFile(modulePath, source)
  vi.stubEnv('WEAPP_VITE_NATIVE', '1')
  vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', modulePath)
  vi.resetModules()
  return {
    ast: await import('./index'),
    native: await import('./native'),
    observation: await import('./native/observation'),
  }
}

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.resetModules()
  if (fixtureDirectory) {
    await rm(fixtureDirectory, { force: true, recursive: true })
    fixtureDirectory = undefined
  }
})

describe('optional native batch analysis', () => {
  it('shares diagnostics with configured script analysis without changing its public result', async () => {
    const { ast, observation } = await loadFixture()
    const source = 'import { onPageScroll } from "wevu"; require("dep"); wx.request(); onPageScroll(() => {})'
    const { value, stats } = await observation.observeNativeAnalysis(() => {
      const analysis = ast.analyzeScript(source, {
        engine: 'oxc',
        featureFlags: { moduleId: 'wevu', hookToFeature: { onPageScroll: 'scroll' } },
      })
      const warnings = ast.collectOnPageScrollPerformanceWarnings(source, 'inline.ts', { engine: 'babel' })
      return { analysis, warnings }
    })

    expect(value.analysis).toEqual({
      featureFlags: new Set(['scroll']),
      hasPlatformApiAccess: true,
      hasStaticRequireLiteral: true,
    })
    expect(value.warnings).toHaveLength(1)
    expect(value.warnings[0]).toContain('空的 onPageScroll(...) 回调')
    expect(stats).toMatchObject({ bindingCalls: 1, inputScripts: 1, cacheHits: 1, fallbacks: 0 })
  })

  it('keeps filenames and feature options in the cache identity', async () => {
    const { ast, native, observation } = await loadFixture()
    const source = 'import { onPageScroll } from "wevu"; onPageScroll(() => {})'
    const { stats } = await observation.observeNativeAnalysis(() => {
      native.analyzeScriptWithNative(source, { filename: 'page.ts' })
      ast.collectOnPageScrollPerformanceWarnings(source, 'page.ts')
      ast.collectOnPageScrollPerformanceWarnings(source, 'page.tsx')
      native.analyzeScriptWithNative(source, { filename: 'page.tsx', moduleId: 'wevu', hookToFeature: { onPageScroll: 'scroll' } })
      native.analyzeScriptWithNative(`${source}\n`, { filename: 'page.tsx' })
    })

    expect(stats).toMatchObject({ bindingCalls: 4, inputScripts: 4, cacheHits: 1 })
  })

  it('counts a multi-input native call and strips diagnostics from public batch results', async () => {
    const { ast, observation } = await loadFixture()
    const inputs = [{ code: 'wx.request()', filename: 'other.ts' }, { code: 'onPageScroll(() => {})', filename: 'page.ts' }]
    const { value, stats } = await observation.observeNativeAnalysis(() => {
      const results = ast.analyzeScripts(inputs, { engine: 'oxc' })
      expect(ast.collectOnPageScrollPerformanceWarnings(inputs[1].code, 'page.ts')).toHaveLength(1)
      return results
    })

    expect(value).toEqual([
      { featureFlags: new Set(), hasPlatformApiAccess: true, hasStaticRequireLiteral: false },
      { featureFlags: new Set(), hasPlatformApiAccess: false, hasStaticRequireLiteral: false },
    ])
    expect(stats).toMatchObject({ bindingCalls: 1, batchCalls: 1, inputScripts: 2, cacheHits: 1 })
  })

  it.each(['babel', 'oxc'] as const)('preserves the configured %s diagnostic engine and its fallback', async (engine) => {
    const { ast, observation } = await loadFixture()
    const source = '/* failNative */ onPageScroll(() => { wx.getStorageSync("key") })'
    const baseline = engine === 'babel'
      ? ast.collectOnPageScrollWarningsWithBabel(source, 'page.ts')
      : ast.collectOnPageScrollWarningsWithOxc(source, 'page.ts')
    const { value, stats } = await observation.observeNativeAnalysis(() => ast.collectOnPageScrollPerformanceWarnings(source, 'page.ts', { engine }))

    expect(value).toEqual(baseline)
    expect(value).toHaveLength(1)
    expect(stats).toMatchObject({ bindingCalls: engine === 'oxc' ? 0 : 1, fallbacks: engine === 'oxc' ? 0 : 1 })
  })

  it('retains the independent diagnostic entry for older native bindings', async () => {
    const { ast, observation } = await loadFixture(`${fixture}
exports.collectOnPageScrollDiagnosticsNative = () => [
  { kind: 'empty', line: 1, column: 14, sourceLabel: 'onPageScroll(...)' },
]
exports.analyzeScriptNative = () => { throw new Error('diagnostics must not probe batch support') }
`)

    const { value, stats } = await observation.observeNativeAnalysis(() => ast.collectOnPageScrollPerformanceWarnings('onPageScroll(() => {})', 'page.ts'))
    expect(value).toHaveLength(1)
    expect(stats).toMatchObject({ bindingCalls: 1, fallbacks: 0 })
  })

  it('keeps disabled native analysis cold, including after an enabled cache hit', async () => {
    const { ast, observation } = await loadFixture()
    ast.analyzeScripts([{ code: 'onPageScroll(() => {})', filename: 'page.ts' }])
    ast.collectOnPageScrollWarningsWithNative('onPageScroll(() => {})', 'page.ts')
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
    const { value, stats } = await observation.observeNativeAnalysis(() => {
      expect(ast.collectOnPageScrollWarningsWithNative('onPageScroll(() => {})', 'page.ts')).toBeUndefined()
      return ast.collectOnPageScrollPerformanceWarnings('onPageScroll(() => {})', 'page.ts', { engine: 'oxc' })
    })

    expect(value).toHaveLength(1)
    expect(stats).toMatchObject({ bindingCalls: 0, cacheHits: 0, inputBytes: 0, fallbacks: 0 })
  })

  it('isolates concurrent observers and only computes input sizes when observing', async () => {
    const { observation } = await loadFixture()
    const results = await Promise.all([
      observation.observeNativeAnalysis(async () => {
        observation.recordNativeCall('中文')
        await Promise.resolve()
        observation.recordNativeEvent('cacheHits')
      }),
      observation.observeNativeAnalysis(async () => {
        await Promise.resolve()
        observation.recordNativeCall([{ code: 'a' }, { code: 'bc' }])
      }),
    ])

    expect(results[0].stats).toMatchObject({ bindingCalls: 1, inputScripts: 1, inputBytes: 6, cacheHits: 1 })
    expect(results[1].stats).toMatchObject({ bindingCalls: 1, batchCalls: 1, inputScripts: 2, inputBytes: 3, cacheHits: 0 })
    expect(() => observation.recordNativeCall([{
      get code(): string {
        throw new Error('disabled observer read source')
      },
    }])).not.toThrow()
  })

  it('observes a separately loaded module instance across the source and dist boundary', async () => {
    const { observation } = await loadFixture()
    vi.resetModules()
    const otherInstance = await import('./native/observation')
    const { stats } = await observation.observeNativeAnalysis(() => otherInstance.recordNativeCall('code'))

    expect(stats).toMatchObject({ bindingCalls: 1, inputScripts: 1, inputBytes: 4 })
    expect(() => otherInstance.recordNativeCall([{
      get code(): string {
        throw new Error('observer subscription leaked')
      },
    }])).not.toThrow()
  })
})
