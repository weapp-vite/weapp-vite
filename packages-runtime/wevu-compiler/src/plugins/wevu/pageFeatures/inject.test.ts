import type { ModuleResolver } from './types'
import { describe, expect, it } from 'vitest'
import { injectWevuPageFeaturesInJs, injectWevuPageFeaturesInJsWithResolver } from './inject'

describe('injectWevuPageFeatures', () => {
  it('returns original source when no flags or no options object are detected', () => {
    const noFlags = injectWevuPageFeaturesInJs(`
import { defineComponent } from 'wevu'
defineComponent({
  setup() {},
})
    `.trim())
    expect(noFlags.transformed).toBe(false)

    const noOptions = injectWevuPageFeaturesInJs(`
import { onShareTimeline } from 'wevu'
onShareTimeline(() => ({}))
    `.trim())
    expect(noOptions.transformed).toBe(false)
  })

  it('injects features for hook calls in current file', () => {
    const result = injectWevuPageFeaturesInJs(`
import { defineComponent, onShareTimeline } from 'wevu'
defineComponent({
  setup() {
    onShareTimeline(() => ({}))
  },
})
    `.trim())

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('features')
    expect(result.code).toContain('enableOnShareTimeline')
  })

  it('injects features with oxc ast engine option', () => {
    const result = injectWevuPageFeaturesInJs(`
import { defineComponent, onShareTimeline } from 'wevu'
defineComponent({
  setup() {
    onShareTimeline(() => ({}))
  },
})
    `.trim(), {
      astEngine: 'oxc',
    })

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnShareTimeline')
  })

  it('injects features resolved from setup reachable imported functions', async () => {
    const pageId = '/project/src/pages/index.ts'
    const helperId = '/project/src/pages/useShare.ts'
    const helperImplId = '/project/src/pages/useShareImpl.ts'
    const codeById = new Map<string, string>([
      [helperId, `export { useShare as default } from './useShareImpl'`],
      [helperImplId, `
import { onReachBottom } from 'wevu'
export function useShare() {
  onReachBottom(() => ({}))
}
      `.trim()],
    ])

    const resolver: ModuleResolver = {
      async resolveId(source, importer) {
        if (importer === pageId && source === './useShare') {
          return helperId
        }
        if (importer === helperId && source === './useShareImpl') {
          return helperImplId
        }
        return undefined
      },
      async loadCode(id) {
        return codeById.get(id)
      },
    }

    const result = await injectWevuPageFeaturesInJsWithResolver(`
import { defineComponent } from 'wevu'
import useShare from './useShare'

defineComponent({
  setup() {
    useShare()
  },
})
    `.trim(), {
      id: pageId,
      resolver,
    })

    expect(result.transformed).toBe(true)
    expect(result.code).toContain('enableOnReachBottom')
  })

  it('fast rejects unrelated files with resolver when ast engine is oxc', async () => {
    const source = `
import { ref } from 'vue'

export function useStore() {
  return ref(1)
}
    `.trim()

    const result = await injectWevuPageFeaturesInJsWithResolver(source, {
      id: '/project/src/store.ts',
      astEngine: 'oxc',
      resolver: {
        async resolveId() {
          return undefined
        },
        async loadCode() {
          return undefined
        },
      },
    })

    expect(result.transformed).toBe(false)
    expect(result.code).toBe(source)
  })
})
