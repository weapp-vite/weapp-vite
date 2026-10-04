import { baseParse } from '@vue/compiler-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectScriptSetupImportsFromCode } from '../../../../../ast'
import { createScriptSetupAnalyzer } from './index'

vi.mock('@vue/compiler-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vue/compiler-core')>()
  return { ...actual, baseParse: vi.fn(actual.baseParse) }
})
vi.mock('../../../../../ast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../ast')>()
  return { ...actual, collectScriptSetupImportsFromCode: vi.fn(actual.collectScriptSetupImportsFromCode) }
})

const input = {
  filename: 'src/pages/demo.vue',
  template: '<DemoCard /><demo-card />',
  scriptSetup: 'import DemoCard from "./DemoCard.vue"',
  astEngine: 'babel' as const,
}

describe('script setup pure analysis cache', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shares template and import facts across repeated physical source requests', () => {
    const analyzer = createScriptSetupAnalyzer()
    const first = analyzer.analyze(input)
    for (let index = 0; index < 3; index += 1) {
      expect(analyzer.analyze({ ...input, filename: `${input.filename}?vue&type=script` })).toEqual(first)
    }
    expect(baseParse).toHaveBeenCalledTimes(1)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(1)
    expect(first.autoImportTags).toEqual(['DemoCard', 'demo-card'])
    expect(first.imports[0]?.templateTags).toEqual(['DemoCard', 'demo-card'])
  })

  it('reuses imports for ordinary template edits and equivalent case-sensitive name sets', () => {
    const analyzer = createScriptSetupAnalyzer()
    analyzer.analyze(input)
    analyzer.analyze({ ...input, template: '<view>changed</view><DemoCard /><demo-card />' })
    const reordered = analyzer.analyze({ ...input, template: '<demo-card /><DemoCard />' })
    expect(baseParse).toHaveBeenCalledTimes(3)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(1)
    expect(reordered.imports[0]?.templateTags).toEqual(['demo-card', 'DemoCard'])

    expect(analyzer.analyze({ ...input, template: '<democard />' }).imports).toEqual([])
    expect(analyzer.analyze({ ...input, template: '<demo-card />' }).imports[0]?.templateTags).toEqual(['demo-card'])
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(3)
  })

  it('invalidates imports on engine or script changes, and reanalyzes restored source', () => {
    const analyzer = createScriptSetupAnalyzer()
    const first = analyzer.analyze(input)
    expect(analyzer.analyze({ ...input, astEngine: 'oxc' })).toEqual(first)
    const changed = analyzer.analyze({ ...input, scriptSetup: 'import DemoCard from "./Alternate.vue"' })
    expect(changed.imports[0]?.importSource).toBe('./Alternate.vue')
    expect(analyzer.analyze(input)).toEqual(first)
    expect(baseParse).toHaveBeenCalledTimes(1)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(4)
  })

  it('retains only the latest template and isolates physical sources and loaders', () => {
    const analyzer = createScriptSetupAnalyzer()
    analyzer.analyze(input)
    analyzer.analyze({ ...input, template: '<OtherCard />' })
    analyzer.analyze(input)
    analyzer.analyze({ ...input, filename: 'src/pages/other.vue' })
    createScriptSetupAnalyzer().analyze(input)
    expect(baseParse).toHaveBeenCalledTimes(5)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(5)
    analyzer.clear()
    analyzer.analyze(input)
    expect(baseParse).toHaveBeenCalledTimes(6)
  })

  it('returns deeply frozen snapshots that survive later source replacement', () => {
    const analyzer = createScriptSetupAnalyzer()
    const first = analyzer.analyze(input)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.autoImportTags)).toBe(true)
    expect(Object.isFrozen(first.imports)).toBe(true)
    expect(Object.isFrozen(first.imports[0])).toBe(true)
    expect(Object.isFrozen(first.imports[0]?.templateTags)).toBe(true)
    expect(Reflect.set(first.imports[0]!, 'importSource', './polluted')).toBe(false)
    expect(Reflect.set(first.imports[0]!.templateTags, 0, 'Polluted')).toBe(false)
    analyzer.analyze({ ...input, template: '<OtherCard />' })
    expect(first.imports[0]?.templateTags).toEqual(['DemoCard', 'demo-card'])
    expect(analyzer.analyze(input)).toEqual(first)
  })

  it('retries empty import results including failed parses and type-only imports', () => {
    const analyzer = createScriptSetupAnalyzer()
    for (const scriptSetup of ['import DemoCard from', 'import type DemoCard from "./DemoCard.vue"']) {
      expect(analyzer.analyze({ ...input, scriptSetup }).imports).toEqual([])
      expect(analyzer.analyze({ ...input, scriptSetup }).imports).toEqual([])
    }
    expect(baseParse).toHaveBeenCalledTimes(1)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(4)
    expect(analyzer.analyze(input).imports).toHaveLength(1)
  })

  it('does not cache a failed template traversal or its partial imports', async () => {
    const actual = await vi.importActual<typeof import('@vue/compiler-core')>('@vue/compiler-core')
    const partial = actual.baseParse('<DemoCard /><OtherCard />')
    Object.defineProperty(partial.children[1], 'type', {
      get() {
        throw new Error('partial traversal')
      },
    })
    vi.mocked(baseParse).mockReturnValueOnce(partial)
    const analyzer = createScriptSetupAnalyzer()
    expect(analyzer.analyze(input).imports[0]?.templateTags).toEqual(['DemoCard'])
    expect(analyzer.analyze(input).imports[0]?.templateTags).toEqual(['DemoCard', 'demo-card'])
    expect(baseParse).toHaveBeenCalledTimes(2)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(2)
  })

  it('skips import parsing without setup or component candidates', () => {
    const analyzer = createScriptSetupAnalyzer()
    expect(analyzer.analyze({ ...input, scriptSetup: undefined }).imports).toEqual([])
    expect(analyzer.analyze({ ...input, template: '<view />' }).imports).toEqual([])
    expect(collectScriptSetupImportsFromCode).not.toHaveBeenCalled()
  })
})
