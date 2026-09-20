import { describe, expect, it } from 'vitest'
import { collectRenderedStyleSources, createStyleSourceMeta } from './styleOwnership'

describe('rendered style sources', () => {
  it('uses live CSS modules and SFC source metadata while ignoring raw invalidation edges', () => {
    const owner = '/src/page.vue'
    const virtualStyle = `${owner}?type=style&lang.css`
    const rawStyle = '/src/other.css?raw&lang.js'
    const graph = new Map([
      [owner, { importedIds: [virtualStyle, rawStyle], meta: {} }],
      [virtualStyle, { importedIds: [owner], meta: createStyleSourceMeta(['/src/page.css']) }],
      [rawStyle, { importedIds: [], meta: createStyleSourceMeta(['/src/other.css']) }],
    ])
    const plugin = { getModuleInfo: (id: string) => graph.get(id) ?? null }
    expect(collectRenderedStyleSources(plugin, owner)).toEqual(new Set([owner, '/src/page.css']))
    graph.set(owner, { importedIds: [rawStyle], meta: {} })
    expect(collectRenderedStyleSources(plugin, owner)).toEqual(new Set())
  })

  it('resolves native stylesheet requests using their real source extension', () => {
    const owner = '/src/page.js'
    const native = '/src/page.css?nativeStyle=acss'
    const plugin = {
      getModuleInfo: (id: string) => ({ importedIds: id === owner ? [native] : [] }),
    }
    expect(collectRenderedStyleSources(plugin, owner)).toEqual(new Set(['/src/page.acss']))
  })
})
