import { describe, expect, it } from 'vitest'
import { collectOnPageScrollDiagnosticsNative } from '../index.js'

describe('@weapp-vite/ast-native', () => {
  it('collects native onPageScroll diagnostics', () => {
    const source = `import { onPageScroll as onScroll } from 'wevu'
import * as wevu from 'wevu'

const page = {
  onPageScroll() {
    this.setData({ top: 1 })
    wx.getStorageSync('k')
  },
}

onScroll(() => {
  function run() {
    this.setData({ nested: true })
    wx.getStorageSync('nested')
  }

  wx.getSystemInfoSync()
})

wevu.onPageScroll?.(() => {})`

    expect(collectOnPageScrollDiagnosticsNative(source)).toEqual([
      {
        column: 5,
        kind: 'setData',
        line: 6,
        sourceLabel: 'onPageScroll',
      },
      {
        column: 5,
        kind: 'syncApi',
        line: 7,
        sourceLabel: 'onPageScroll',
        syncApi: 'wx.getStorageSync',
      },
      {
        column: 3,
        kind: 'syncApi',
        line: 17,
        sourceLabel: 'onPageScroll(...)',
        syncApi: 'wx.getSystemInfoSync',
      },
      {
        column: 21,
        kind: 'empty',
        line: 20,
        sourceLabel: 'onPageScroll(...)',
      },
    ])
  })
})
