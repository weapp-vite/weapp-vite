import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'
import { afterEach, describe, expect, it } from 'vitest'

const virtualEntryId = fileURLToPath(new URL('./__virtual-entry__.js', import.meta.url))
const openBundles: Array<{ close: () => Promise<void> }> = []

async function bundleVirtualEntry(source: string) {
  const bundle = await rolldown({
    input: virtualEntryId,
    plugins: [
      {
        name: 'virtual-entry',
        resolveId(id) {
          if (id === virtualEntryId) {
            return id
          }
        },
        load(id) {
          if (id === virtualEntryId) {
            return source
          }
        },
      },
    ],
    treeshake: true,
  })
  openBundles.push(bundle)
  const output = await bundle.generate({ format: 'esm' })
  return output.output
    .map(chunk => chunk.type === 'chunk' ? chunk.code : String(chunk.source))
    .join('\n')
}

afterEach(async () => {
  const pending = openBundles.splice(0, openBundles.length)
  await Promise.all(pending.map(bundle => bundle.close()))
})

describe('wevu internal entry tree-shaking', () => {
  it('keeps reactivity-only imports away from component runtime', async () => {
    const code = await bundleVirtualEntry(`
import { nextTick, ref } from './internal-reactivity.ts'

const count = ref(1)
nextTick(() => {
  console.log(count.value)
})
    `.trim())

    expect(code).toContain('ref(')
    expect(code).not.toContain('createWevuComponent')
    expect(code).not.toContain('Component(')
    expect(code).not.toContain('WEVU_RUNTIME_APP_KEY')
    expect(code).not.toContain('WEVU_TEMPLATE_REFS_KEY')
  })

  it('keeps template helper imports away from component runtime', async () => {
    const code = await bundleVirtualEntry(`
import { normalizeClass } from './internal-template.ts'

console.log(normalizeClass({ active: true }))
    `.trim())

    expect(code).toContain('normalizeClass')
    expect(code).not.toContain('createWevuComponent')
    expect(code).not.toContain('Component(')
    expect(code).not.toContain('WEVU_RUNTIME_APP_KEY')
    expect(code).not.toContain('WEVU_TEMPLATE_REFS_KEY')
  })
})
