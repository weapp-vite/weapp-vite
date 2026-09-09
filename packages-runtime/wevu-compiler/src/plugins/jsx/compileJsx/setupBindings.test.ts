import { describe, expect, it } from 'vitest'
import { compileJsxFile } from '../compileJsxFile'

describe('JSX setup ref template bindings', () => {
  it('uses unwrapped paths for text, attributes, conditions and lists while preserving script closures', async () => {
    const result = await compileJsxFile(`
      import { defineComponent, ref } from 'wevu'
      export default defineComponent({ setup() {
        const count = ref(2)
        const rows = ref([{ value: 'row' }])
        const increment = () => { count.value++ }
        return () => <view title={count.value}>
          <text>setup count: {count.value}</text>
          {count.value > 0 && <text>positive</text>}
          {rows.value.map(row => <text>{row.value}</text>)}
          <button onTap={increment}>increment</button>
        </view>
      } })
    `, 'src/pages/setup-ref.tsx', { isPage: true })
    expect(result.template).toContain('title="{{count}}"')
    expect(result.template).toContain('setup count: {{count}}')
    expect(result.template).toContain('wx:if="{{count>0}}"')
    expect(result.template).toContain('wx:for="{{rows}}"')
    expect(result.template).toContain('{{row.value}}')
    expect(result.template).not.toContain('count.value')
    expect(result.script).toContain('count.value++')
    expect(result.script).toMatch(/return\s*\{\s*count,\s*rows,\s*increment\s*\}/)
    expect(result.bindingManifest?.bindings.find(binding => binding.kind === 'attribute')).toMatchObject({
      outputPath: 'count',
      dependencies: [{ root: 'count', path: 'count', updateMode: 'exact-path' }],
    })
  })

  it('does not unwrap plain objects or a loop local that shadows a setup ref', async () => {
    const result = await compileJsxFile(`
      import { ref } from 'wevu'
      export default { setup() {
        const item = ref(2)
        const plain = { value: 'literal' }
        const wrapped = ref({ value: 'wrapped-literal' })
        const rows = ref([{ value: 'nested' }])
        return () => <view>{item.value}{plain.value}{wrapped.value.value}{rows.value.map(item => <text key={item.value}>{item.value}</text>)}</view>
      } }
    `, 'src/pages/shadowed-ref.tsx')
    expect(result.template).toContain('{{item}}{{plain.value}}{{wrapped.value}}')
    expect(result.template).toContain('wx:key="item.value"')
    expect(result.template).toContain('<text>{{item.value}}</text>')
  })

  it('resolves aliased and namespace ref APIs and destructured toRefs captures', async () => {
    const result = await compileJsxFile(`
      import { ref as makeRef, computed, reactive, toRefs, readonly } from 'wevu'
      import * as Vue from 'vue'
      export default { setup: () => {
        const count = makeRef(2)
        const alias = count
        const total = computed(() => count.value * 2)
        const state = Vue.shallowRef({ label: 'ready' })
        const frozen = readonly(count)
        const { title: label } = toRefs(reactive({ title: 'title' }))
        return () => <text>{alias.value}/{total.value}/{state.value.label}/{frozen.value}/{label.value}</text>
      } }
    `, 'src/pages/aliased-ref.tsx')
    expect(result.template).toBe('<text>{{alias}}/{{total}}/{{state.label}}/{{frozen}}/{{label}}</text>')
    expect(result.script).toMatch(/return\s*\{\s*alias,\s*total,\s*state,\s*frozen,\s*label\s*\}/)
  })

  it('preserves explicit ref access inside JavaScript event expressions', async () => {
    const result = await compileJsxFile(`
      import { ref } from 'wevu'
      export default { setup() {
        const count = ref(2)
        return () => <button onTap={() => count.value++}>{count.value}</button>
      } }
    `, 'src/pages/inline-ref.tsx')
    expect(result.template).toContain('>{{count}}</button>')
    expect(result.script).toContain('count.value++')
  })

  it('does not classify shadowed imports or ordinary value factories as refs', async () => {
    const result = await compileJsxFile(`
      import { ref } from 'wevu'
      export default { setup() {
        function ref() { return { value: 'ordinary' } }
        const value = ref()
        return () => <text>{value.value}</text>
      } }
    `, 'src/pages/local-factory.tsx')
    expect(result.template).toBe('<text>{{value.value}}</text>')
  })

  it('does not assume a mutable setup local remains a ref after reassignment', async () => {
    const result = await compileJsxFile(`
      import { ref } from 'wevu'
      export default { setup() {
        let value: any = ref(2)
        value = { value: 'ordinary' }
        return () => <text>{value.value}</text>
      } }
    `, 'src/pages/reassigned-ref.tsx')
    expect(result.template).toBe('<text>{{value.value}}</text>')
  })
})
