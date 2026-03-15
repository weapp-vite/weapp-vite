import { describe, expect, it } from 'vitest'
import { parseJsLike } from '../../../../utils/babel'
import { createModuleAnalysis } from '../moduleAnalysis'
import { collectWevuFeaturesFromCodeReachableImports } from './index'
import { walkReachableWevuFeatures } from './walk'

describe('reachability walk', () => {
  it('collects reachable features from local, external, reexport and namespace calls', async () => {
    const pageSource = `
import { onShareTimeline } from 'wevu'
import { helper } from './ext'
import * as extNs from './ns'

function localFn() {
  onShareTimeline()
}

export function setup() {
  localFn()
  helper()
  extNs.useNs()
}
    `.trim()

    const moduleCodeById: Record<string, string> = {
      '/project/src/ext.ts': `
import { onPageScroll, onReachBottom } from 'wevu'
import runDefault from './defaultHook'
import { reFn } from './reexp'

function internal() {
  onReachBottom?.()
}

export function helper() {
  onPageScroll()
  internal()
  runDefault()
  reFn()
}
      `.trim(),
      '/project/src/defaultHook.ts': `
import { onAddToFavorites } from 'wevu'
export default function runDefault() {
  onAddToFavorites()
}
      `.trim(),
      '/project/src/reexp.ts': `
export { hookBridge as reFn } from './final'
      `.trim(),
      '/project/src/final.ts': `
import { onPullDownRefresh } from 'wevu'
export function hookBridge() {
  onPullDownRefresh()
}
      `.trim(),
      '/project/src/ns.ts': `
import * as wevu from 'wevu'
export function useNs() {
  wevu.onResize?.()
}
      `.trim(),
    }

    const resolveMap: Record<string, string> = {
      './ext': '/project/src/ext.ts',
      './defaultHook': '/project/src/defaultHook.ts',
      './reexp': '/project/src/reexp.ts',
      './final': '/project/src/final.ts',
      './ns': '/project/src/ns.ts',
    }

    const pageModule = createModuleAnalysis('/project/src/page.ts', parseJsLike(pageSource))
    const setupFn = pageModule.localFunctions.get('setup')!
    const resolver = {
      resolveId: async (source: string) => resolveMap[source],
      loadCode: async (id: string) => moduleCodeById[id],
    }

    const enabled = await walkReachableWevuFeatures({
      pageModule,
      setupFn,
      resolver,
      moduleCache: new Map(),
    })

    expect(enabled.has('enableOnShareTimeline')).toBe(true)
    expect(enabled.has('enableOnPageScroll')).toBe(true)
    expect(enabled.has('enableOnReachBottom')).toBe(true)
    expect(enabled.has('enableOnAddToFavorites')).toBe(true)
    expect(enabled.has('enableOnPullDownRefresh')).toBe(true)
    expect(enabled.has('enableOnResize')).toBe(true)
  })

  it('ignores unresolved and non-exported calls', async () => {
    const pageSource = `
import { missing } from './missing'
import { notFound } from './known'

export function setup() {
  missing()
  notFound()
}
    `.trim()

    const pageModule = createModuleAnalysis('/project/src/page.ts', parseJsLike(pageSource))
    const setupFn = pageModule.localFunctions.get('setup')!

    const resolver = {
      resolveId: async (source: string) => {
        if (source === './known') {
          return '/project/src/known.ts'
        }
      },
      loadCode: async (id: string) => {
        if (id === '/project/src/known.ts') {
          return `export const ok = 1`
        }
      },
    }

    const enabled = await walkReachableWevuFeatures({
      pageModule,
      setupFn,
      resolver,
      moduleCache: new Map(),
    })

    expect(enabled.size).toBe(0)
  })

  it('collects reachable features from source with ast engine option', async () => {
    const pageSource = `
import { defineComponent } from 'wevu'
import { helper } from './ext'

defineComponent({
  setup() {
    helper()
  },
})
    `.trim()

    const moduleCodeById: Record<string, string> = {
      '/project/src/ext.ts': `
import { onPageScroll } from 'wevu'
export function helper() {
  onPageScroll()
}
      `.trim(),
    }

    const resolver = {
      resolveId: async (source: string) => source === './ext' ? '/project/src/ext.ts' : undefined,
      loadCode: async (id: string) => moduleCodeById[id],
    }

    const enabled = await collectWevuFeaturesFromCodeReachableImports(pageSource, {
      id: '/project/src/page.ts',
      resolver,
      astEngine: 'oxc',
    })

    expect(enabled.has('enableOnPageScroll')).toBe(true)
  })
})
