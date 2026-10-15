import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { collectComponentSourceInfo } from '../componentSources'
import { analyzeNativeSlotContext } from './index'
import { createAnalysisFixture } from './testSupport'

const leaf = '<template><text>pure</text></template>'
const consumer = `<script setup>import { inject } from 'wevu'; inject('token')</script><template><text>context</text></template>`
const root = `<script setup>import Child from './Child.vue'</script><template><Child /></template>`

describe('native slot context input and cache ownership', () => {
  it.each(['child', 'grandchild', 'helper'])('recomputes unchanged parents after deleting only the changed %s source key', async (changed) => {
    const fixture = createAnalysisFixture({
      '/project/Child.vue': `<script setup>import Grandchild from './Grandchild.vue'</script><template><Grandchild /></template>`,
      '/project/Grandchild.vue': `<script setup>import { useValue } from './helper'; const value = useValue()</script><template><text>{{ value }}</text></template>`,
      '/project/helper.ts': 'export function useValue() { return 1 }',
    })
    const id = changed === 'child' ? '/project/Child.vue' : changed === 'grandchild' ? '/project/Grandchild.vue' : '/project/helper.ts'
    const original = fixture.files.get(id)!
    expect((await fixture.analyze(root)).required).toBe(false)
    const initialReads = fixture.reads.length
    expect((await fixture.analyze(root)).required).toBe(false)
    expect(fixture.reads).toHaveLength(initialReads)
    fixture.files.set(id, changed === 'helper' ? `import { inject } from 'wevu'; export function useValue() { return inject('token') }` : consumer)
    fixture.cache.delete(id)
    const participating = await fixture.analyze(root)
    expect(participating.required).toBe(true)
    expect(participating.dependencies).toContain(id)
    fixture.files.set(id, original)
    fixture.cache.delete(id)
    const restored = await fixture.analyze(root)
    expect(restored.required).toBe(false)
    expect(restored.tags.size).toBe(0)
    expect(restored.dependencies).toEqual(expect.arrayContaining(['/project/Child.vue', '/project/Grandchild.vue', '/project/helper.ts']))
  })

  it('uses the supplied current root descriptor even if that source was cached as a child', async () => {
    const fixture = createAnalysisFixture({ '/project/Child.vue': leaf })
    await fixture.analyze(root)
    const reads = fixture.reads.length
    const changedRoot = await fixture.analyze(consumer, '/project/Child.vue')
    expect(changedRoot.required).toBe(true)
    expect(changedRoot.dependencies).not.toContain('/project/Child.vue')
    expect(fixture.reads).toHaveLength(reads)
    expect((await fixture.analyze(leaf, '/project/Child.vue')).required).toBe(false)
  })

  it('retains current root facts when a descendant cycles back to the root source', async () => {
    const fixture = createAnalysisFixture({
      '/project/Root.vue': leaf,
      '/project/Child.vue': `<script setup>import Root from './Root.vue'</script><template><Root /></template>`,
    })
    const result = await fixture.analyze(root)
    expect(result.required).toBe(true)
    expect(result.tags).toContain('Child')
    expect(fixture.reads).not.toContain('/project/Root.vue')
  })

  it('tracks external child blocks separately and resolves their relative helper and child imports', async () => {
    const fixture = createAnalysisFixture({
      '/project/Child.vue': '<script src="./scripts/child.ts"></script><template src="./templates/child.html" />',
      '/project/scripts/child.ts': `import { defineComponent } from 'wevu'; import Nested from './Nested.vue'; import { useValue } from './helper'; export default defineComponent({ components: { Nested }, setup() { return { value: useValue() } } })`,
      '/project/scripts/Nested.vue': leaf,
      '/project/scripts/helper.ts': 'export function useValue() { return 1 }',
      '/project/templates/child.html': '<view><Nested /><text>{{ value }}</text></view>',
    })
    const result = await fixture.analyze(root)
    expect(result.required).toBe(false)
    expect(result.dependencies).toEqual(expect.arrayContaining([
      '/project/Child.vue',
      '/project/scripts/child.ts',
      '/project/scripts/Nested.vue',
      '/project/scripts/helper.ts',
      '/project/templates/child.html',
    ]))
    fixture.files.set('/project/scripts/helper.ts', `import { inject } from 'wevu'; export function useValue() { return inject('token') }`)
    fixture.cache.delete('/project/scripts/helper.ts')
    expect((await fixture.analyze(root)).required).toBe(true)
    fixture.files.set('/project/scripts/helper.ts', 'export function useValue() { return 1 }')
    fixture.cache.delete('/project/scripts/helper.ts')
    expect((await fixture.analyze(root)).required).toBe(false)
    fixture.files.set('/project/templates/child.html', '<slot />')
    fixture.cache.delete('/project/templates/child.html')
    expect((await fixture.analyze(root)).required).toBe(true)
    fixture.files.set('/project/templates/child.html', '<text>pure</text>')
    fixture.cache.delete('/project/templates/child.html')
    expect((await fixture.analyze(root)).required).toBe(false)
  })

  it('invalidates only an external script key while keeping its SFC descriptor cached', async () => {
    const fixture = createAnalysisFixture({
      '/project/Child.vue': '<script src="./external.ts"></script><template><text /></template>',
      '/project/external.ts': 'export default { setup() { return {} } }',
    })
    expect((await fixture.analyze(root)).required).toBe(false)
    fixture.files.set('/project/external.ts', `import { inject } from 'wevu'; export default { setup() { inject('token'); return {} } }`)
    fixture.cache.delete('/project/external.ts')
    expect((await fixture.analyze(root)).required).toBe(true)
    fixture.files.set('/project/external.ts', 'export default { setup() { return {} } }')
    fixture.cache.delete('/project/external.ts')
    expect((await fixture.analyze(root)).required).toBe(false)
    expect(fixture.reads.filter(id => id === '/project/Child.vue')).toHaveLength(1)
  })

  it('does not reread or replace an already resolved current external block', async () => {
    const fixture = createAnalysisFixture({ '/project/external.ts': 'stale and invalid disk contents (' })
    const descriptor = parse('<script src="./external.ts"></script><template><text /></template>').descriptor
    descriptor.script!.content = `import { ref } from 'wevu'; export default { setup() { return { count: ref(0) } } }`
    const components = await collectComponentSourceInfo({
      descriptor,
      descriptorForCompile: descriptor,
      filename: '/project/Root.vue',
      compileOptions: fixture.options,
      autoUsingComponents: undefined,
      autoImportTags: undefined,
    })
    const result = await analyzeNativeSlotContext({ descriptor, filename: '/project/Root.vue', options: fixture.options, components })
    expect(result.required).toBe(false)
    expect(result.dependencies).toContain('/project/external.ts')
    expect(fixture.reads).not.toContain('/project/external.ts')
  })

  it('records unavailable external inputs and remains conservative', async () => {
    const fixture = createAnalysisFixture({
      '/project/Child.vue': '<script src="./missing.ts"></script><template src="./missing.html" />',
    })
    const result = await fixture.analyze(root)
    expect(result.required).toBe(true)
    expect(result.dependencies).toEqual(expect.arrayContaining(['/project/Child.vue', '/project/missing.ts', '/project/missing.html']))
  })

  it('normalizes query source IDs and keeps compiler-owned wrappers conservative', async () => {
    const fixture = createAnalysisFixture({ '/project/Child.vue': leaf })
    fixture.options.autoUsingComponents!.resolveUsingComponentPath = async () => ({
      from: './Child',
      sourceType: 'wevu-sfc',
      resolvedId: '/project/Child.vue?vue&type=script',
    })
    const result = await fixture.analyze(root)
    expect(result.required).toBe(false)
    expect(result.dependencies).toContain('/project/Child.vue')
    expect(result.dependencies.some(id => id.includes('?'))).toBe(false)
    fixture.options.appShell = { importPath: '/project/Shell.vue', tagName: 'app-shell' }
    expect((await fixture.analyze(leaf)).required).toBe(true)
  })

  it('keeps cache instances isolated and tracks every branch even after a context seed', async () => {
    const first = createAnalysisFixture({ '/project/Child.vue': consumer, '/project/Other.vue': leaf })
    const second = createAnalysisFixture({ '/project/Child.vue': leaf })
    const source = `<script setup>import Child from './Child.vue'; import Other from './Other.vue'</script><template><Child /><Other /></template>`
    const result = await first.analyze(source)
    expect(result.required).toBe(true)
    expect(result.dependencies).toEqual(expect.arrayContaining(['/project/Child.vue', '/project/Other.vue']))
    expect((await second.analyze(root)).required).toBe(false)
    expect(second.reads).toContain('/project/Child.vue')
  })

  it('follows relative helper imports in the standalone compiler without a host resolver', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'native-context-analysis-'))
    const filename = path.join(directory, 'Root.vue')
    const helper = path.join(directory, 'helper.ts')
    try {
      await writeFile(helper, `import { inject } from 'wevu'; export function useValue() { return inject('token') }`)
      const descriptor = parse(`<script setup>import { useValue } from './helper'; useValue()</script><template><text /></template>`, { filename }).descriptor
      const components = await collectComponentSourceInfo({ descriptor, descriptorForCompile: descriptor, filename, compileOptions: undefined, autoUsingComponents: undefined, autoImportTags: undefined })
      const result = await analyzeNativeSlotContext({ descriptor, filename, options: undefined, components })
      expect(result.required).toBe(true)
      expect(result.dependencies).toContain(helper)
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
