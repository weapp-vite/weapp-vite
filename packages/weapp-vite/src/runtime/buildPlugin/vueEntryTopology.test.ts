import type { CompilerContext } from '../../context'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { getRecordedVueEntryExternalBlockSources, getRecordedVueEntryTopologySignature, hasRecordedVueEntryExternalBlocks, resolveVueEntryTopologySignature } from './vueEntryTopology'

vi.mock('vue/compiler-sfc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue/compiler-sfc')>()
  return { ...actual, parse: vi.fn(actual.parse) }
})

function owner() {
  return { platform: 'weapp', weappViteConfig: {} } as CompilerContext['configService']
}

function signature(source: string, config = owner(), file = path.resolve('vue-topology-fixture/page.vue')) {
  return resolveVueEntryTopologySignature(config, file, source)
}

describe('prepared Vue entry topology facts', () => {
  it('ignores ordinary text, marker, styles and native tag changes while retaining component dependencies', () => {
    const source = '<script setup>import Card from "./Card.vue"; const marker = "before"</script><template><Card/><view>{{marker}}</view></template><style>.before{color:red}</style>'
    expect(signature(source)).toBe(signature(source.replaceAll('before', 'after').replace('<view>', '<text>').replace('</view>', '</text>')))
    expect(signature(source)).not.toBe(signature(source.replace('./Card.vue', './Other.vue')))
    expect(signature(source)).not.toBe(signature(source.replace('<Card/>', '')))
    expect(signature(source)).not.toBe(signature(source.replace('import Card from "./Card.vue";', '')))
  })

  it('ignores unused and type-only imports, comment whitespace and component order', () => {
    const source = '<script setup lang="ts">import Card from "./Card.vue"; import type { Shape } from "./shape"; import unused from "./unused"</script><template><Card/><OtherCard/></template>'
    const changed = source.replace('./shape', './other-shape').replace('./unused', './other-unused').replace('<Card/><OtherCard/>', '<OtherCard/><!-- marker --><Card/>')
    expect(signature(source)).toBe(signature(changed))
  })

  it('follows Options API component aliases and only includes registrations used by the template', () => {
    const source = '<script>import Imported from "./Card.vue"; import Unused from "./unused.vue"; export default { components: { AliasCard: Imported, OtherCard: Unused }, data(){ return { marker: "before" } } }</script><template><alias-card/></template>'
    expect(signature(source)).not.toBe(signature(source.replace('./Card.vue', './NewCard.vue')))
    expect(signature(source)).not.toBe(signature(source.replace('AliasCard: Imported', 'AliasCard: Unused')))
    expect(signature(source)).toBe(signature(source.replace('./unused.vue', './new-unused.vue').replace('before', 'after')))
  })

  it('follows local aliases and async component imports without executing component factories', () => {
    const source = '<script setup>import Original from "./Card.vue"; const Alias = Original; const marker = "before"; const Lazy = defineAsyncComponent(() => import("./Lazy.vue"))</script><template><Alias/><Lazy/></template>'
    expect(signature(source)).not.toBe(signature(source.replace('./Card.vue', './Other.vue')))
    expect(signature(source)).not.toBe(signature(source.replace('./Lazy.vue', './OtherLazy.vue')))
    expect(signature(source)).toBe(signature(source.replace('before', 'after')))
  })

  it('follows the script binding behind member component tags', () => {
    const source = '<script setup>import * as UI from "./components"; const marker = "before"</script><template><UI.Card/><view>{{marker}}</view></template>'
    expect(signature(source)).not.toBe(signature(source.replace('./components', './other-components')))
    expect(signature(source)).toBe(signature(source.replace('before', 'after')))
    const local = '<script setup>import Card from "./Card.vue"; const UI = { Card }</script><template><UI.Card/></template>'
    expect(signature(local)).not.toBe(signature(local.replace('./Card.vue', './Other.vue')))
  })

  it('compares inline JSON entry fields independently from presentation and property ordering', () => {
    const source = '<template><view/></template><json>{"usingComponents":{"a":"/a","b":"/b"},"navigationBarTitleText":"before"}</json>'
    const reordered = '<template><text/></template><json>{"navigationBarTitleText":"after","usingComponents":{"b":"/b","a":"/a"}}</json>'
    expect(signature(source)).toBe(signature(reordered))
    expect(signature(source)).not.toBe(signature(source.replace('"/a"', '"/new"')))
    expect(signature(source)).not.toBe(signature('<template><view/></template>'))
    const generic = '<json>{"componentGenerics":{"card":{"default":"/card"}}}</json>'
    expect(signature(generic)).not.toBe(signature(generic.replace('/card', '/other')))
  })

  it('ignores JSON comments while retaining macro topology and its local binding dependencies', () => {
    const source = '<script setup>const components = { card: "/card" }; const marker = "before"; definePageJson({ usingComponents: components, navigationBarTitleText: marker })</script><template><view/></template><json>{/* comment */"component":false}</json>'
    expect(signature(source)).toBe(signature(source.replace('before', 'after').replace('comment', 'changed comment')))
    expect(signature(source)).not.toBe(signature(source.replace('"/card"', '"/other"')))
    expect(signature(source)).not.toBe(signature(source.replace('usingComponents: components, ', '')))
  })

  it('recognizes imported macro aliases and does not treat a foreign function as the compiler macro', () => {
    const source = '<script setup>import { definePageJson as pageJson } from "wevu"; pageJson({usingComponents:{card:"/card"}})</script><template><view/></template>'
    expect(signature(source)).not.toBe(signature(source.replace('/card', '/other')))
    const foreign = source.replace('"wevu"', '"other-library"')
    expect(signature(foreign)).toBe(signature(foreign.replace('/card', '/other')))
  })

  it('matches the JSON compiler canonical macro names regardless of their imported source', () => {
    const source = '<script setup>import { definePageJson } from "weapp-vite"; definePageJson({usingComponents:{card:"/card"},navigationBarTitleText:"before"})</script><template><view/></template>'
    expect(signature(source)).not.toBe(signature(source.replace('/card', '/other')))
    expect(signature(source)).toBe(signature(source.replace('before', 'after')))
    const foreign = source.replace('"weapp-vite"', '"other-library"')
    expect(signature(foreign)).not.toBe(signature(foreign.replace('/card', '/other')))
  })

  it('conservatively retains computed JSON fields and their local key and value dependencies', () => {
    const source = '<script setup>const key = "usingComponents"; const source = "/card"; const marker = "before"; definePageJson({[key]:{card:source},navigationBarTitleText:marker})</script><template><view/></template>'
    expect(signature(source)).not.toBe(signature(source.replace('"usingComponents"', '"otherField"')))
    expect(signature(source)).not.toBe(signature(source.replace('"/card"', '"/other"')))
    expect(signature(source)).toBe(signature(source.replace('before', 'after')))
  })

  it('tracks static and dynamic layout selection while ignoring layout props and page titles', () => {
    const source = '<script setup>const marker = "before"; definePageMeta({title: marker, layout:{name:"default",props:{title:marker}}})</script><template><view/></template>'
    expect(signature(source)).toBe(signature(source.replace('before', 'after')))
    expect(signature(source)).not.toBe(signature(source.replace('name:"default"', 'name:"other"')))
    expect(signature(source)).not.toBe(signature(source.replace('layout:{name:"default",props:{title:marker}}', 'layout:false')))
    const dynamic = '<script setup>const marker = "before"; function change(){setPageLayout("default", {title: marker})}</script><template><view/></template>'
    expect(signature(dynamic)).toBe(signature(dynamic.replace('before', 'after')))
    expect(signature(dynamic)).not.toBe(signature(dynamic.replace('setPageLayout("default"', 'setPageLayout("other"')))
  })

  it('tracks dynamic component selection and its imports without reacting to unrelated values', () => {
    const source = '<script setup>import Card from "./Card.vue"; const selected = Card; const marker = "before"</script><template><component :is="selected"/><view>{{marker}}</view></template>'
    expect(signature(source)).not.toBe(signature(source.replace('./Card.vue', './Other.vue')))
    expect(signature(source)).toBe(signature(source.replace('before', 'after')))
    expect(signature('<template><component is="Card"/></template>')).not.toBe(signature('<template><component is="Other"/></template>'))
  })

  it('records external script and template ownership without reading their contents or including style sources', () => {
    const config = owner()
    const file = path.resolve('vue-topology-fixture/page.vue')
    const source = '<script src="./logic.ts"></script><template src="./view.html"></template><style src="./style.css"></style>'
    const before = signature(source, config, file)
    expect(hasRecordedVueEntryExternalBlocks(config, file)).toBe(true)
    expect(getRecordedVueEntryExternalBlockSources(config, file)).toEqual(['./view.html', './logic.ts'])
    expect(signature(source.replace('./style.css', './other.css'), config, file)).toBe(before)
    expect(signature(source.replace('./view.html', './other.html'), config, file)).not.toBe(before)
    expect(signature(source.replace('./logic.ts', './other.ts'), config, file)).not.toBe(before)
  })

  it('keeps invalid input diagnostics with the compiler and conservatively changes its fallback signature', () => {
    const source = '<script setup>import {</script><template><Card/></template>'
    expect(() => signature(source)).not.toThrow()
    expect(signature(source)).toMatch(/^unresolved:/)
    expect(signature(source)).toBe(signature(source))
    expect(signature(source)).not.toBe(signature(`${source}\n`))
  })

  it('reuses exact prepared-source facts within the owner session and retains only signatures for capture', () => {
    const config = owner()
    const file = path.resolve('vue-topology-fixture/page.vue')
    const source = '<script setup>import Card from "./Card.vue"</script><template><Card/></template>'
    vi.mocked(parse).mockClear()
    const first = signature(source, config, file)
    expect(signature(source, config, file)).toBe(first)
    expect(getRecordedVueEntryTopologySignature(config, file)).toBe(first)
    expect(parse).toHaveBeenCalledOnce()
    signature(source, owner(), file)
    expect(parse).toHaveBeenCalledTimes(2)
    expect(getRecordedVueEntryTopologySignature(owner(), file)).toBeUndefined()
  })

  it('retains a fixed-size signature even when a reached dynamic declaration is large', () => {
    const source = `<script setup>const selected = ${JSON.stringify('large'.repeat(20000))}</script><template><component :is="selected"/></template>`
    const config = owner()
    const file = path.resolve('vue-topology-fixture/large.vue')
    const result = signature(source, config, file)
    expect(result).toMatch(/^topology:[a-f0-9]{64}$/)
    expect(getRecordedVueEntryTopologySignature(config, file)).toBe(result)
  })
})
