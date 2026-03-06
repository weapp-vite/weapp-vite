import { describe, expect, it } from 'vitest'
import { collectOnPageScrollPerformanceWarnings } from '../../src/plugins/performance/onPageScrollDiagnostics'

describe('collectOnPageScrollPerformanceWarnings', () => {
  it('warns for setData and wx sync api usage in onPageScroll hook', () => {
    const source = `import { onPageScroll as onScroll } from 'wevu'

onScroll(() => {
  this.setData({ top: 1 })
  wx.getStorageSync('k')
})`

    const warnings = collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts')
    expect(warnings.length).toBe(2)
    expect(warnings[0]).toContain('onPageScroll(...) 内调用 setData')
    expect(warnings[1]).toContain('wx.getStorageSync')
  })

  it('warns for empty onPageScroll option handler', () => {
    const source = `Page({
  onPageScroll() {},
})`

    const warnings = collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts')
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('空的 onPageScroll 回调')
  })

  it('supports namespace onPageScroll optional call', () => {
    const source = `import * as wevu from 'wevu'

wevu.onPageScroll?.(() => {
  wx.getSystemInfoSync()
})`

    const warnings = collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts')
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('wx.getSystemInfoSync')
  })

  it('returns empty warnings when source cannot be parsed', () => {
    const warnings = collectOnPageScrollPerformanceWarnings('<template><view/></template>', '/src/pages/index.vue')
    expect(warnings).toEqual([])
  })
})
