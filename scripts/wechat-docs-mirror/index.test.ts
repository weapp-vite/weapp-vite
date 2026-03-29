import assert from 'node:assert/strict'
import { it } from 'vitest'
import {
  normalizeFrameworkPageUrl,
  toMirrorRelativePath,
  toRelativeAssetPath,
  toRelativeMarkdownHref,
} from './pathing'

it('normalizes framework URLs and rejects out-of-scope pages', () => {
  assert.equal(
    normalizeFrameworkPageUrl('./quickstart/code.html?foo=bar#JSON-配置', 'https://developers.weixin.qq.com/miniprogram/dev/framework/'),
    'https://developers.weixin.qq.com/miniprogram/dev/framework/quickstart/code.html',
  )
  assert.equal(
    normalizeFrameworkPageUrl('https://developers.weixin.qq.com/miniprogram/dev/component/button.html'),
    null,
  )
})

it('maps source URLs to stable mirror paths', () => {
  assert.equal(
    toMirrorRelativePath('https://developers.weixin.qq.com/miniprogram/dev/framework/'),
    'README.md',
  )
  assert.equal(
    toMirrorRelativePath('https://developers.weixin.qq.com/miniprogram/dev/framework/quickstart/'),
    'quickstart/README.md',
  )
  assert.equal(
    toMirrorRelativePath('https://developers.weixin.qq.com/miniprogram/dev/framework/quickstart/code.html'),
    'quickstart/code.md',
  )
})

it('rewrites local page and asset links relative to the current markdown file', () => {
  assert.equal(
    toRelativeMarkdownHref({
      currentPageUrl: 'https://developers.weixin.qq.com/miniprogram/dev/framework/quickstart/code.html',
      targetHref: './../view/wxml/#WXML',
    }),
    '../view/wxml/README.md#WXML',
  )
  assert.equal(
    toRelativeMarkdownHref({
      currentPageUrl: 'https://developers.weixin.qq.com/miniprogram/dev/framework/quickstart/code.html',
      targetHref: '#JSON-配置',
    }),
    '#JSON-配置',
  )
  assert.equal(
    toRelativeAssetPath({
      currentPageUrl: 'https://developers.weixin.qq.com/miniprogram/dev/framework/quickstart/code.html',
      assetRelativePath: '_assets/logo-1234567890ab.png',
    }),
    '../_assets/logo-1234567890ab.png',
  )
})
