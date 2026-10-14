import { fileURLToPath } from 'node:url'
import { compileVueFile } from '@wevu/compiler'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { collectComponentSourceInfo } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/componentSources'
import { analyzeCompilerScriptsWithNative } from '../../ast/src/native'
import { analyzeCompilerScriptsNative } from '../index.js'

const nativeAnalysis = vi.hoisted(() => vi.fn())
const parseBabel = vi.hoisted(() => vi.fn())
vi.mock('@weapp-vite/ast', async (original) => {
  const actual = await original<typeof import('@weapp-vite/ast')>()
  nativeAnalysis.mockImplementation(actual.analyzeCompilerScriptsWithNative)
  return { ...actual, analyzeCompilerScriptsWithNative: nativeAnalysis }
})
vi.mock('../../../packages-runtime/wevu-compiler/src/utils/babel', async (original) => {
  const actual = await original<typeof import('../../../packages-runtime/wevu-compiler/src/utils/babel')>()
  parseBabel.mockImplementation(actual.parse)
  return { ...actual, parse: parseBabel }
})

const scripts = [
  `import Card from 'native/card'; export default { components: { Card } }; declare module 'virtual:card' { const Ambient: any; export default Ambient; }`,
  `import Card from 'native/card'; export default { components: { Card } }; declare module 'virtual:card' { import Card from 'native/ambient'; }`,
  `declare module 'virtual:card' { const Ambient: any; export default Ambient; } import Card from 'native/card'; export default { components: { Card } };`,
  `import Card from 'native/card'; export default { components: { Card } }; namespace Ambient { export namespace Nested { export const marker = 'ambient'; } }`,
  `import Card from 'native/card'; export default { components: { Card } }; declare global { interface Ambient { title: string } }`,
]
const setup = 'const title = "ambient"'
const bindingPath = fileURLToPath(new URL('../index.js', import.meta.url))

function sourceFor(script: string) {
  return `<script lang="ts">${script}</script><script setup lang="ts">${setup}</script><template><Card /><text>{{ title }}</text></template>`
}

async function compile(source: string, native: boolean) {
  vi.stubEnv('WEAPP_VITE_NATIVE', native ? '1' : '0')
  vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', bindingPath)
  const warnings: string[] = []
  try {
    const output = await compileVueFile(source, 'src/ambient.vue', {
      autoUsingComponents: { enabled: true, resolveUsingComponentPath: async value => value },
      warn: value => warnings.push(value),
    })
    return { output, warnings }
  }
  catch (error) {
    return { error, warnings }
  }
}

beforeEach(() => {
  nativeAnalysis.mockClear()
  parseBabel.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

describe('native compiler ambient module fallback parity', () => {
  it.each(scripts)('preserves the complete compiler output, maps and warnings: %s', async (script) => {
    const source = sourceFor(script)
    const baseline = await compile(source, false)
    expect(baseline).toHaveProperty('output')
    expect(baseline.output?.scriptMap).toBeTruthy()
    nativeAnalysis.mockClear()
    const current = await compile(source, true)

    expect(current).toEqual(baseline)
    expect(nativeAnalysis).toHaveBeenCalledTimes(1)
    const results = analyzeCompilerScriptsNative([{ code: script, filename: 'page.ts' }, { code: setup, filename: 'page.ts' }])
    expect(results[0]).toBeNull()
    expect(results[1]).not.toBeNull()
  })

  it('preserves original parser errors and warnings for an invalid ambient declaration', async () => {
    const source = sourceFor('declare module \'virtual:card\' { export default =; }')
    const baseline = await compile(source, false)
    expect(baseline).toHaveProperty('error')
    expect(await compile(source, true)).toEqual(baseline)
  })

  it('retains valid neighbors and parses the rejected Options API item once', async () => {
    vi.stubEnv('WEAPP_VITE_NATIVE', '1')
    vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', bindingPath)
    const results = analyzeCompilerScriptsWithNative([
      { code: 'import Other from \'native/other\'; export default { components: { Other } }', filename: 'page.ts' },
      { code: scripts[1], filename: 'page.ts' },
      { code: setup, filename: 'page.ts' },
    ])
    expect(results?.[0]?.registeredComponents).toEqual([{ name: 'Other', local: 'Other' }])
    expect(results?.[1]).toBeNull()
    expect(results?.[2]).not.toBeNull()

    const { descriptor } = parse(sourceFor(scripts[1]))
    const options = {
      descriptor,
      descriptorForCompile: descriptor,
      filename: 'src/ambient.vue',
      compileOptions: undefined,
      autoImportTags: undefined,
      autoUsingComponents: { resolveUsingComponentPath: async (value: string) => value },
    }
    const baseline = await collectComponentSourceInfo(options)
    parseBabel.mockClear()
    const current = await collectComponentSourceInfo({
      ...options,
      nativeScriptAnalysis: { scriptSetup: results![2]! },
    })
    expect(current).toEqual(baseline)
    expect(current.autoUsingComponentsMap).toEqual({ Card: 'native/ambient' })
    expect(parseBabel).toHaveBeenCalledTimes(1)
  })
})
