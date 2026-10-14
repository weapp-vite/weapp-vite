import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { collectComponentSourceInfo } from './componentSources'

const parseBabel = vi.hoisted(() => vi.fn())
vi.mock('../../../../utils/babel', async (original) => {
  const actual = await original<typeof import('../../../../utils/babel')>()
  parseBabel.mockImplementation(actual.parse)
  return { ...actual, parse: parseBabel }
})

const analysis: NativeCompilerScriptAnalysis = {
  imports: [
    { local: 'Button', imported: 'default', source: 'native/button', kind: 'default', typeOnly: false },
    { local: 'Card', imported: 'Card', source: 'native/card', kind: 'named', typeOnly: false },
    { local: 'Hidden', imported: 'default', source: 'native/hidden', kind: 'default', typeOnly: true },
  ],
  registeredComponents: [{ name: 'action-button', local: 'Button' }, { name: 'Card', local: 'Card' }, { name: 'Hidden', local: 'Hidden' }],
  defineOptionsStatements: [],
}

async function collect(native?: NativeCompilerScriptAnalysis) {
  const { descriptor } = parse(`<script lang="ts">
import Button from 'native/button'
import { Card } from 'native/card'
import type Hidden from 'native/hidden'
export default { components: { 'action-button': Button, Card, Hidden } }
</script><template><action-button /><Card /><Hidden /></template>`)
  return collectComponentSourceInfo({
    descriptor,
    descriptorForCompile: descriptor,
    filename: 'src/page.vue',
    compileOptions: undefined,
    autoImportTags: undefined,
    autoUsingComponents: { resolveUsingComponentPath: async source => source },
    nativeScriptAnalysis: native ? { script: native } : undefined,
  })
}

describe('native Options API registrations', () => {
  it('preserves aliases, named imports, type filtering and template mappings without another parse', async () => {
    const baseline = await collect()
    parseBabel.mockClear()
    const current = await collect(analysis)
    expect(current).toEqual(baseline)
    expect(current.autoUsingComponentsMap).toEqual({ 'action-button': 'native/button', 'Card': 'native/card' })
    expect(parseBabel).not.toHaveBeenCalled()
  })

  it('uses the original Babel path once when the registration shape is not proven', async () => {
    const baseline = await collect()
    parseBabel.mockClear()
    expect(await collect({ ...analysis, registeredComponents: undefined })).toEqual(baseline)
    expect(parseBabel).toHaveBeenCalledTimes(1)
  })
})
