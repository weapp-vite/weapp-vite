import { baseParse } from '@vue/compiler-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectScriptSetupImportsFromCode } from '../../../../../ast'
import { createScriptSetupAnalyzer } from './index'

vi.mock('@vue/compiler-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vue/compiler-core')>()
  return { ...actual, baseParse: vi.fn(actual.baseParse) }
})
vi.mock('../../../../../ast', () => ({
  collectScriptSetupImportsFromCode: vi.fn(() => [{ localName: 'Card', importSource: './Card.vue', kind: 'default' }]),
}))

const input = { filename: 'src/demo.vue', template: '<Card />', scriptSetup: 'import Card from "./Card.vue"', astEngine: 'babel' as const }

describe('script setup analysis retention bounds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps at most 512 sources and refreshes recently used records', () => {
    const analyzer = createScriptSetupAnalyzer()
    const first = { ...input, filename: 'src/0.vue' }
    for (let index = 0; index < 512; index += 1) {
      analyzer.analyze({ ...input, filename: `src/${index}.vue` })
    }
    analyzer.analyze(first)
    analyzer.analyze({ ...input, filename: 'src/512.vue' })
    analyzer.analyze(first)
    expect(baseParse).toHaveBeenCalledTimes(513)
    analyzer.analyze({ ...input, filename: 'src/1.vue' })
    expect(baseParse).toHaveBeenCalledTimes(514)
  })

  it('evicts by retained UTF-16 input size before reaching the source-count limit', () => {
    const analyzer = createScriptSetupAnalyzer()
    const scriptSetup = `${input.scriptSetup}\n/*${'x'.repeat(2 * 1024 * 1024)}*/`
    for (let index = 0; index < 4; index += 1) {
      analyzer.analyze({ ...input, scriptSetup, filename: `src/${index}.vue` })
    }
    analyzer.analyze({ ...input, scriptSetup, filename: 'src/3.vue' })
    expect(baseParse).toHaveBeenCalledTimes(4)
    analyzer.analyze({ ...input, scriptSetup, filename: 'src/0.vue' })
    expect(baseParse).toHaveBeenCalledTimes(5)
  })

  it('runs oversize entries uncached and does not reuse their older cached version', () => {
    const analyzer = createScriptSetupAnalyzer()
    analyzer.analyze(input)
    const large = { ...input, scriptSetup: `${input.scriptSetup}\n/*${'x'.repeat(8 * 1024 * 1024)}*/` }
    expect(analyzer.analyze(large).imports).toHaveLength(1)
    expect(analyzer.analyze(large).imports).toHaveLength(1)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(3)
    analyzer.analyze(input)
    expect(collectScriptSetupImportsFromCode).toHaveBeenCalledTimes(4)
    expect(baseParse).toHaveBeenCalledTimes(3)
  })
})
