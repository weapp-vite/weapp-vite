import { describe, expect, it } from 'vitest'
import { wevu as namedWevu, wevuRouter } from './index'
import wevu from './wevu'

const symbols = (value: Record<string, string[]>) => Object.values(value).flat()

describe('auto import presets', () => {
  it('exports the common wevu preset with unique symbols', () => {
    expect(wevu).toBe(namedWevu)
    expect(symbols(wevu).length).toBe(new Set(symbols(wevu)).size)
    expect(wevu.wevu).toContain('ref')
    expect(wevu.wevu).toContain('onMounted')
    expect(wevu['wevu/router']).toContain('definePage')
    expect(wevu.wevu).not.toContain('definePage')
    expect(wevu.wevu).toEqual(expect.arrayContaining([
      'createStore',
      'createPinia',
      'setActivePinia',
      'getActivePinia',
      'disposePinia',
      'defineStore',
      'storeToRefs',
      'MutationType',
    ]))
  })

  it('exports router APIs from wevu/router', () => {
    expect(wevuRouter['wevu/router']).toContain('useNativeRouter')
    expect(wevuRouter['wevu/router']).toContain('definePage')
    expect(symbols(wevuRouter).length).toBe(new Set(symbols(wevuRouter)).size)
    expect(wevu.wevu).not.toContain('useNativeRouter')
  })
})
