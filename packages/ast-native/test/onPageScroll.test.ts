import { describe, expect, it } from 'vitest'
import {
  analyzeScriptNative,
  analyzeScriptsNative,
  collectFeatureFlagsNative,
  collectOnPageScrollDiagnosticsNative,
  getVueSfcSignaturePayloadNative,
  mayContainPlatformApiAccessNative,
  mayContainStaticRequireLiteralNative,
} from '../index.js'

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

  it('builds Vue SFC signature payloads', () => {
    const source = `<json>
{ "navigationBarTitleText": "首页" }
</json>

<script setup lang="ts">
const count = 1
</script>

<template><view>{{ count }}</view></template>

<style scoped lang="scss">
.count { color: red; }
</style>`

    expect(JSON.parse(getVueSfcSignaturePayloadNative(source)!)).toEqual({
      hasTemplate: true,
      nonJson: {
        customBlocks: [],
        script: null,
        scriptSetup: {
          attrs: {
            lang: 'ts',
            setup: true,
          },
          content: '\nconst count = 1\n',
          type: 'script',
        },
        styles: [
          {
            attrs: {
              lang: 'scss',
              scoped: true,
            },
            content: '\n.count { color: red; }\n',
            type: 'style',
          },
        ],
        template: {
          attrs: {},
          content: '<view>{{ count }}</view>',
          type: 'template',
        },
      },
      script: {
        script: null,
        scriptSetup: {
          attrs: {
            lang: 'ts',
            setup: true,
          },
          content: '\nconst count = 1\n',
          type: 'script',
        },
      },
    })
  })

  it('collects native analysis-only hot paths', () => {
    expect(mayContainStaticRequireLiteralNative(`const dep = require('./dep')`)).toBe(true)
    expect(mayContainStaticRequireLiteralNative('const dep = require(name)')).toBe(false)
    expect(mayContainStaticRequireLiteralNative('const dep = import("./dep")')).toBe(false)

    expect(mayContainPlatformApiAccessNative('const value = wx.getStorageSync("k")')).toBe(true)
    expect(mayContainPlatformApiAccessNative('const value = localStorage.getItem("k")')).toBe(false)

    const source = `import { onLoad as useLoad } from 'wevu'
import * as wevuNs from 'wevu'
const dep = require('./dep')
wx.getStorageSync('k')
useLoad(() => {})
wevuNs.onShow?.(() => {})
`
    expect(collectFeatureFlagsNative(source, 'wevu', JSON.stringify({
      onLoad: 'enableLoad',
      onShow: 'enableShow',
    }))).toEqual(['enableLoad', 'enableShow'])
    expect(analyzeScriptNative(source, 'wevu', JSON.stringify({
      onLoad: 'enableLoad',
      onShow: 'enableShow',
    }))).toEqual({
      featureFlags: ['enableLoad', 'enableShow'],
      hasPlatformApiAccess: true,
      hasStaticRequireLiteral: true,
    })
    expect(analyzeScriptsNative([
      {
        code: source,
        hookToFeatureJson: JSON.stringify({
          onLoad: 'enableLoad',
          onShow: 'enableShow',
        }),
        moduleId: 'wevu',
      },
      {
        code: 'const value = 1',
      },
    ])).toEqual([
      {
        featureFlags: ['enableLoad', 'enableShow'],
        hasPlatformApiAccess: true,
        hasStaticRequireLiteral: true,
      },
      {
        featureFlags: [],
        hasPlatformApiAccess: false,
        hasStaticRequireLiteral: false,
      },
    ])
  })
})
