import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml } from './template'

describe('compileVueTemplateToWxml', () => {
  it('rewrites nullish coalescing in bindings', () => {
    const template = `
<t-icon :name="item.icon ?? 'app'" />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/QuickActionGrid/index.vue')

    const normalized = code.replace(/\s/g, '')
    expect(normalized).toContain(`name="{{item.icon!=null?item.icon:'app'}}"`)
    expect(code).not.toContain('??')
  })

  it('emits array-based scoped slot props', () => {
    const template = `
<slot name="item" :item="card.item" :index="card.index" />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/KpiBoard/index.vue')

    expect(code).toContain(`__wv-slot-props="{{['item',card.item,'index',card.index]}}"`)
    expect(code).not.toContain(`__wv-slot-props="{{{`)
  })

  it('emits array-based slot scope mapping', () => {
    const template = `
<Child v-for="(item, index) in list" :key="index">
  <template #default="{ value }">
    <view>{{ value }}</view>
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`__wv-slot-scope="{{['item',item,'index',index]}}"`)
    expect(code).not.toContain(`__wv-slot-scope="{{{`)
  })
})
