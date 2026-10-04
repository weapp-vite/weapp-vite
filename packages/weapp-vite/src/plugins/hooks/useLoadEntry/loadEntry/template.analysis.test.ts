import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import { baseParse } from '@vue/compiler-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectScriptSetupImportsFromCode } from '../../../../ast'
import logger from '../../../../logger'
import { createScriptSetupAnalyzer } from './scriptSetupAnalysis'
import { applyScriptSetupUsingComponents } from './template'

const readAndParseSfc = vi.hoisted(() => vi.fn())
const resolveUsingComponentReference = vi.hoisted(() => vi.fn())

vi.mock('@vue/compiler-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vue/compiler-core')>()
  return { ...actual, baseParse: vi.fn(actual.baseParse) }
})
vi.mock('../../../utils/vueSfc', () => ({
  readAndParseSfc,
  createReadAndParseSfcOptions: (_plugin: unknown, _config: unknown, options: unknown) => options,
}))
vi.mock('../../../vue/transform/usingComponentResolver', () => ({ resolveUsingComponentReference }))
vi.mock('../../../../ast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../ast')>()
  return { ...actual, collectScriptSetupImportsFromCode: vi.fn(actual.collectScriptSetupImportsFromCode) }
})
vi.mock('../../../../logger', () => ({ default: { warn: vi.fn() } }))

describe('script setup entry analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readAndParseSfc.mockResolvedValue({
      descriptor: {
        template: { content: '<DemoCard /><demo-card />' },
        scriptSetup: { content: 'import DemoCard from "./DemoCard.vue"' },
      },
      errors: [],
    })
    resolveUsingComponentReference.mockResolvedValue({ from: '/components/demo-card' })
  })

  function apply(source: string, extra: Partial<Parameters<typeof applyScriptSetupUsingComponents>[0]> = {}) {
    return applyScriptSetupUsingComponents({
      pluginCtx: {} as PluginContext,
      configService: { weappViteConfig: {} } as CompilerContext['configService'],
      vueEntryPath: 'src/pages/demo.vue',
      source,
      templatePath: '',
      json: {},
      reExportResolutionCache: new Map(),
      ...extra,
    })
  }

  it('creates one template AST for auto-import and script setup component views', async () => {
    await apply('<template><DemoCard /><demo-card /></template>')

    expect(baseParse).toHaveBeenCalledTimes(1)
    expect(resolveUsingComponentReference).toHaveBeenCalledTimes(1)
  })

  it('resolves an external template when the supplied SFC has no inline component tag', async () => {
    const source = '<template data-label="a > b" src="./template.html"></template><script setup src="./setup.ts"></script>'
    await apply(source)

    expect(readAndParseSfc).toHaveBeenCalledWith('src/pages/demo.vue', { source })
    expect(resolveUsingComponentReference).toHaveBeenCalledTimes(1)
  })

  it('repeats resolution, publication, JSON conflicts and entry registration on cache hits', async () => {
    const scriptSetupAnalyzer = createScriptSetupAnalyzer()
    const setWxmlComponentsMap = vi.fn()
    const externalComponentEntryMap = new Map<string, string>()
    for (let index = 0; index < 4; index += 1) {
      const from = `/components/version-${index}`
      const resolvedId = `src/components/version-${index}.vue`
      resolveUsingComponentReference.mockResolvedValueOnce({ from, resolvedId })
      const json = { usingComponents: { DemoCard: '/legacy', unrelated: '/preserved' } }
      await apply('<template><DemoCard /><demo-card /></template>', {
        scriptSetupAnalyzer,
        wxmlService: { setWxmlComponentsMap } as unknown as CompilerContext['wxmlService'],
        externalComponentEntryMap,
        json,
      })
      expect(json.usingComponents).toEqual({ 'DemoCard': from, 'demo-card': from, 'unrelated': '/preserved' })
      expect(externalComponentEntryMap.get(`components/version-${index}`)).toBe(resolvedId)
    }
    expect(baseParse).toHaveBeenCalledTimes(1)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(1)
    expect(readAndParseSfc).toHaveBeenCalledTimes(4)
    expect(resolveUsingComponentReference).toHaveBeenCalledTimes(4)
    expect(setWxmlComponentsMap).toHaveBeenCalledTimes(4)
    expect(logger.warn).toHaveBeenCalledTimes(4)
  })

  it('keeps overlapping resolved-source requests independent when the older read finishes last', async () => {
    const scriptSetupAnalyzer = createScriptSetupAnalyzer()
    let finishOld: (value: unknown) => void = () => {}
    readAndParseSfc.mockImplementationOnce(() => new Promise((resolve) => {
      finishOld = resolve
    }))
    const oldJson: Record<string, unknown> = {}
    const pendingOld = apply('<template><OldCard /></template>', { scriptSetupAnalyzer, json: oldJson })
    const newJson: Record<string, unknown> = {}
    await apply('<template><DemoCard /></template>', { scriptSetupAnalyzer, json: newJson })
    finishOld({
      descriptor: {
        template: { content: '<OldCard />' },
        scriptSetup: { content: 'import OldCard from "./OldCard.vue"' },
      },
      errors: [],
    })
    await pendingOld
    const restoredJson: Record<string, unknown> = {}
    await apply('<template><DemoCard /></template>', { scriptSetupAnalyzer, json: restoredJson })
    expect(oldJson.usingComponents).toEqual({ OldCard: '/components/demo-card' })
    expect(newJson.usingComponents).toEqual({ 'DemoCard': '/components/demo-card', 'demo-card': '/components/demo-card' })
    expect(restoredJson).toEqual(newJson)
    expect(baseParse).toHaveBeenCalledTimes(3)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(3)
  })

  it('keeps failed SFC reads observable on every attempt', async () => {
    const scriptSetupAnalyzer = createScriptSetupAnalyzer()
    readAndParseSfc.mockRejectedValue(new Error('external source unavailable'))
    await apply('<template src="./missing.html" />', { scriptSetupAnalyzer })
    await apply('<template src="./missing.html" />', { scriptSetupAnalyzer })
    expect(logger.warn).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenLastCalledWith(expect.stringContaining('external source unavailable'))
    expect(baseParse).not.toHaveBeenCalled()
  })

  it('retires old facts when all component candidates disappear before restoring the source', async () => {
    const scriptSetupAnalyzer = createScriptSetupAnalyzer()
    const source = '<template><DemoCard /></template>'
    await apply(source, { scriptSetupAnalyzer })
    await apply('<template><view>plain</view></template>', { scriptSetupAnalyzer })
    await apply(source, { scriptSetupAnalyzer })
    expect(baseParse).toHaveBeenCalledTimes(2)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(2)
  })
})
