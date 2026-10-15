import { describe, expect, it } from 'vitest'
import { createAnalysisFixture } from './testSupport'

const leaf = '<template><text>pure</text></template>'
const consumer = `<script setup>import { inject } from 'wevu'; const value = inject('token')</script><template><text>{{ value }}</text></template>`

describe('native slot context dependency graph', () => {
  it('ignores type-only helper imports and re-exports while following value dependencies', async () => {
    const fixture = createAnalysisFixture({
      '/project/helper.ts': `import type { Context } from 'unavailable-types'; export { type InjectionKey, ref } from 'vue'; export { type Hidden } from 'missing-types'; export function useValue(): number { return 1 }`,
    })
    const result = await fixture.analyze(`<script setup>import { useValue } from './helper'; const value = useValue()</script><template><text>{{ value }}</text></template>`)
    expect(result.required).toBe(false)
    expect(result.dependencies).toEqual(['/project/helper.ts'])
  })

  it('excludes an entire pure component tree and keeps every source dependency', async () => {
    const fixture = createAnalysisFixture({
      '/project/Container.vue': `<script setup>import Counter from './Counter.vue'</script><template><Counter /></template>`,
      '/project/Counter.vue': `<script setup>import { useCounter } from './counter'; const counter = useCounter()</script><template><button @click="counter++">{{ counter }}</button></template>`,
      '/project/counter.ts': `import { ref } from 'wevu'; export function useCounter() { return ref(0) }`,
    })
    const result = await fixture.analyze(`<script setup>import Container from './Container.vue'</script><template><Container /></template>`)
    expect(result.required).toBe(false)
    expect(result.tags.size).toBe(0)
    expect(result.dependencies).toEqual(expect.arrayContaining(['/project/Container.vue', '/project/Counter.vue', '/project/counter.ts']))
  })

  it('retains every owning ancestor of an injecting descendant and filters pure sibling aliases', async () => {
    const fixture = createAnalysisFixture({
      '/project/PureChild.vue': leaf,
      '/project/Wrapper.vue': `<script setup>import Child from './Consumer.vue'</script><template><Child /></template>`,
      '/project/Consumer.vue': consumer,
    })
    const result = await fixture.analyze(`<script setup>
import PureChild from './PureChild.vue'
import ContextWrapper from './Wrapper.vue'
</script><template><pure-child /><ContextWrapper /><context-wrapper /></template>`)
    expect(result.required).toBe(true)
    expect(result.tags).toEqual(new Set(['ContextWrapper', 'context-wrapper']))
    expect(result.dependencies).toEqual(expect.arrayContaining(['/project/PureChild.vue', '/project/Wrapper.vue', '/project/Consumer.vue']))
  })

  it('follows composable and named re-export dependencies', async () => {
    const fixture = createAnalysisFixture({
      '/project/helpers.ts': `export { useToken as useValue } from './useToken'`,
      '/project/useToken.ts': `import { inject as take } from 'vue'; export function useToken() { return take('token') }`,
    })
    const result = await fixture.analyze(`<script setup>import { useValue as useLocal } from './helpers'; const value = useLocal()</script><template><text>{{ value }}</text></template>`)
    expect(result.required).toBe(true)
    expect(result.dependencies).toEqual(expect.arrayContaining(['/project/helpers.ts', '/project/useToken.ts']))
  })

  it('uses the component collector for named barrel and Options API registration aliases', async () => {
    const fixture = createAnalysisFixture({
      '/project/components.ts': `export { default as NamedLeaf } from './Leaf.vue'`,
      '/project/Leaf.vue': leaf,
    })
    fixture.options.autoUsingComponents!.resolveUsingComponentPath = async (source, _importer, imported) => {
      if (source === './components' && imported?.importedName === 'NamedLeaf') {
        return { from: '/components/leaf', resolvedId: '/project/Leaf.vue', sourceType: 'wevu-sfc' }
      }
      return undefined
    }
    const source = `<script lang="ts">
import { defineComponent as define } from 'vue'
import { NamedLeaf as Imported } from './components'
const options = { components: { localLeaf: Imported } } satisfies Record<string, unknown>
export default define(options)
</script><template><local-leaf /></template>`
    const result = await fixture.analyze(source)
    expect(result.required).toBe(false)
    expect(result.tags.size).toBe(0)
    expect(result.dependencies).toEqual(expect.arrayContaining(['/project/components.ts', '/project/Leaf.vue']))
    fixture.files.set('/project/Leaf.vue', consumer)
    fixture.cache.delete('/project/Leaf.vue')
    const changed = await fixture.analyze(source)
    expect(changed.required).toBe(true)
  })

  it('resolves auto components relative to each descendant importer', async () => {
    const fixture = createAnalysisFixture({
      '/project/nested/Wrapper.vue': '<template><AutoChild /></template>',
      '/project/nested/Consumer.vue': consumer,
    })
    const calls: Array<[string, string | undefined]> = []
    fixture.options.autoImportTags = {
      enabled: true,
      async resolveUsingComponent(tag, importer) {
        calls.push([tag, importer])
        if (tag === 'AutoChild' && importer === '/project/nested/Wrapper.vue') {
          return { name: 'AutoChild', from: './Consumer', resolvedId: '/project/nested/Consumer.vue', sourceType: 'wevu-sfc' }
        }
        return undefined
      },
    }
    const result = await fixture.analyze(`<script setup>import Wrapper from './nested/Wrapper.vue'</script><template><Wrapper /></template>`)
    expect(result.required).toBe(true)
    expect(result.tags).toContain('Wrapper')
    expect(calls).toContainEqual(['AutoChild', '/project/nested/Wrapper.vue'])
    expect(result.dependencies).toContain('/project/nested/Consumer.vue')
  })

  it('keeps unavailable children conservative and records the unavailable source', async () => {
    const result = await createAnalysisFixture().analyze(`<script setup>import Missing from './Missing.vue'</script><template><Missing /></template>`)
    expect(result.required).toBe(true)
    expect(result.dependencies).toContain('/project/Missing.vue')
  })

  it('records native component sources without treating their tags as wevu declarations', async () => {
    const fixture = createAnalysisFixture({ '/project/native.js': 'Component({})' })
    fixture.options.autoImportTags = {
      enabled: true,
      async resolveUsingComponent() {
        return { name: 'native-box', from: './native', resolvedId: '/project/native.js', sourceType: 'native' }
      },
    }
    const result = await fixture.analyze('<template><native-box /></template>')
    expect(result.required).toBe(true)
    expect(result.tags.size).toBe(0)
    expect(result.dependencies).toContain('/project/native.js')
  })

  it('terminates component and helper cycles conservatively, including concurrent cache users', async () => {
    const fixture = createAnalysisFixture({
      '/project/A.vue': `<script setup>import B from './B.vue'</script><template><B /></template>`,
      '/project/B.vue': `<script setup>import A from './A.vue'; import './one'</script><template><A /></template>`,
      '/project/one.ts': `export { two } from './two'; export const one = 1`,
      '/project/two.ts': `export { one } from './one'; export const two = 2`,
    })
    const source = `<script setup>import A from './A.vue'</script><template><A /></template>`
    const results = await Promise.all([fixture.analyze(source), fixture.analyze(source)])
    for (const result of results) {
      expect(result.required).toBe(true)
      expect(result.dependencies).toEqual(expect.arrayContaining(['/project/A.vue', '/project/B.vue', '/project/one.ts', '/project/two.ts']))
    }
    expect(fixture.reads.filter(id => id === '/project/A.vue')).toHaveLength(1)
  })
})
