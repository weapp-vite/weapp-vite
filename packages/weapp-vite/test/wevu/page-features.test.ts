import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { injectWevuPageFeaturesInJs, injectWevuPageFeaturesInJsWithResolver } from '../../src/plugins/wevu/pageFeatures'

describe('wevu page features', () => {
  it('injects features into top-level defineComponent options', () => {
    const source = `import { defineComponent, onShareAppMessage } from 'wevu'

defineComponent({
  setup() {
    onShareAppMessage(() => ({}))
  },
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('features')
    expect(result.code).toContain('enableOnShareAppMessage')
  })

  it('supports aliased hook imports', () => {
    const source = `import { defineComponent, onReachBottom as onBottom } from 'wevu'

defineComponent({
  setup() {
    onBottom(() => {})
  },
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnReachBottom')
  })

  it('does not touch non-wevu pages', () => {
    const source = `Page({
  onLoad() {},
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(false)
    expect(result.code).toBe(source)
  })

  it('does not override explicit feature flags', () => {
    const source = `import { defineComponent, onShareAppMessage } from 'wevu'

defineComponent({
  features: { enableOnShareAppMessage: false },
  setup() {
    onShareAppMessage(() => ({}))
  },
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(false)
    expect(result.code).toBe(source)
  })

  it('collects features from setup-called imported composition functions', async () => {
    const entryId = '/src/pages/index.ts'
    const composableId = '/src/composables/useShare.ts'

    const files = new Map<string, string>([
      [entryId, `import { defineComponent } from 'wevu'
import { useShare } from '../composables/useShare'

defineComponent({
  setup() {
    useShare()
  },
})`],
      [composableId, `import { onReachBottom, onShareAppMessage } from 'wevu'

export function useShare() {
  onShareAppMessage(() => ({}))
  onReachBottom(() => {})
}`],
    ])

    const entry = files.get(entryId)!
    const result = await injectWevuPageFeaturesInJsWithResolver(entry, {
      id: entryId,
      resolver: {
        resolveId: async (source, importer) => {
          if (!source.startsWith('.')) {
            return undefined
          }
          const resolved = path.resolve(path.dirname(importer), source)
          const withExt = resolved.endsWith('.ts') ? resolved : `${resolved}.ts`
          return files.has(withExt) ? withExt : undefined
        },
        loadCode: async id => files.get(id),
      },
    })

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnShareAppMessage')
    expect(result.code).toContain('enableOnReachBottom')
  })

  it('supports namespace import for ctor and hooks', () => {
    const source = `import * as wevu from 'wevu'

wevu.defineComponent({
  setup() {
    wevu.onTabItemTap(() => {})
  },
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnTabItemTap')
  })

  it('supports optional chaining member hook calls', () => {
    const source = `import * as wevu from 'wevu'

wevu.defineComponent({
  setup() {
    wevu.onShareTimeline?.(() => ({}))
  },
})`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnShareTimeline')
  })

  it('supports options object identifier defined after call', () => {
    const source = `import { defineComponent, onPullDownRefresh } from 'wevu'

defineComponent(__wevuOptions)

const __wevuOptions = {
  setup() {
    onPullDownRefresh(() => {})
  },
}`

    const result = injectWevuPageFeaturesInJs(source)

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnPullDownRefresh')
  })

  it('collects features from default-exported composables via resolver', async () => {
    const entryId = '/src/pages/index.ts'
    const composableId = '/src/composables/useShare.ts'

    const files = new Map<string, string>([
      [entryId, `import { defineComponent } from 'wevu'
import useShare from '../composables/useShare'

defineComponent({
  setup() {
    useShare()
  },
})`],
      [composableId, `import { onResize } from 'wevu'

export default function useShare() {
  onResize(() => {})
}`],
    ])

    const entry = files.get(entryId)!
    const result = await injectWevuPageFeaturesInJsWithResolver(entry, {
      id: entryId,
      resolver: {
        resolveId: async (source, importer) => {
          if (!source.startsWith('.')) {
            return undefined
          }
          const resolved = path.resolve(path.dirname(importer), source)
          const withExt = resolved.endsWith('.ts') ? resolved : `${resolved}.ts`
          return files.has(withExt) ? withExt : undefined
        },
        loadCode: async id => files.get(id),
      },
    })

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnResize')
  })

  it('collects features through re-export barrels', async () => {
    const entryId = '/src/pages/index.ts'
    const barrelId = '/src/composables/index.ts'
    const composableId = '/src/composables/useShare.ts'

    const files = new Map<string, string>([
      [entryId, `import { defineComponent } from 'wevu'
import { useShare } from '../composables'

defineComponent({
  setup() {
    useShare()
  },
})`],
      [barrelId, `export { useShare } from './useShare'`],
      [composableId, `import { onPageScroll } from 'wevu'

export function useShare() {
  onPageScroll(() => {})
}`],
    ])

    const entry = files.get(entryId)!
    const result = await injectWevuPageFeaturesInJsWithResolver(entry, {
      id: entryId,
      resolver: {
        resolveId: async (source, importer) => {
          if (!source.startsWith('.')) {
            return undefined
          }
          const resolved = path.resolve(path.dirname(importer), source)
          const candidates = resolved.endsWith('.ts')
            ? [resolved]
            : [`${resolved}.ts`, path.join(resolved, 'index.ts')]
          return candidates.find(candidate => files.has(candidate))
        },
        loadCode: async id => files.get(id),
      },
    })

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnPageScroll')
  })
})
