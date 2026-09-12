import { describe, expect, it } from 'vitest'
import { wevu as namedWevu, wevuRouter } from './index'
import wevu from './wevu'

const symbols = (value: Record<string, string[]>) => Object.values(value).flat()

describe('auto import presets', () => {
  it('exports the wevu preset with stable module keys and unique symbols', () => {
    expect(wevu).toBe(namedWevu)
    expect(Object.keys(wevu)).toEqual(['wevu'])
    expect(symbols(wevu).length).toBe(new Set(symbols(wevu)).size)
    expect(wevu.wevu).toContain('ref')
    expect(wevu.wevu).toContain('onMounted')
  })

  it('exports router APIs from wevu/router', () => {
    expect(Object.keys(wevuRouter)).toEqual(['wevu/router'])
    expect(wevuRouter['wevu/router']).toContain('useNativeRouter')
    expect(symbols(wevuRouter).length).toBe(new Set(symbols(wevuRouter)).size)
    expect(wevu.wevu).not.toContain('useNativeRouter')
  })
})
