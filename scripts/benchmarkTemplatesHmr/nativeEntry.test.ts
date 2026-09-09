import { describe, expect, it } from 'vitest'
import { isNativeBenchmarkScriptEntry } from './nativeEntry'

describe('native benchmark script ownership', () => {
  it('selects the native entry instead of smaller type and utility files in its directory', () => {
    const files = ['pages/order/types.ts', 'pages/order/utils.js', 'pages/order/index.ts', 'pages/order/index.wxml']
    const sources = new Set(files)
    expect(files.filter(file => isNativeBenchmarkScriptEntry(file, sources))).toEqual(['pages/order/index.ts'])
  })

  it('does not invent a native script output for a Vue-only component', () => {
    const files = ['components/reason-sheet/types.ts', 'components/reason-sheet/index.vue']
    expect(files.filter(file => isNativeBenchmarkScriptEntry(file, new Set(files)))).toEqual([])
  })

  it('supports normalized Windows entries and native HTML while excluding declarations', () => {
    const sources = new Set(['pages/home/index.html', 'pages/home/types.d.wxml'])
    expect(isNativeBenchmarkScriptEntry('pages\\home\\index.js', sources)).toBe(true)
    expect(isNativeBenchmarkScriptEntry('pages/home/types.d.ts', sources)).toBe(false)
  })
})
