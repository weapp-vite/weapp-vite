import { describe, expect, it } from 'vitest'
import {
  findSkylineRendererFiles,
  formatHmrRuntimeStartupMessages,
  resolveHmrRuntime,
  resolveHmrRuntimeDecision,
} from './hmrRuntime'

describe('resolveHmrRuntime', () => {
  it.each(['auto', undefined] as const)('uses stateful runtime when WeChat hot reload is enabled (%s)', (configured) => {
    expect(resolveHmrRuntime({ platform: 'weapp', configured, compileHotReLoad: true })).toBe('stateful-experimental')
    expect(resolveHmrRuntimeDecision({ platform: 'weapp', configured, compileHotReLoad: true })).toEqual({
      configured: 'auto',
      reason: 'auto-stateful',
      runtime: 'stateful-experimental',
    })
  })

  it.each([false, undefined, 'true', 1])('uses classic when hot reload is not confirmed (%s)', (compileHotReLoad) => {
    expect(resolveHmrRuntime({ platform: 'weapp', configured: 'auto', compileHotReLoad })).toBe('classic')
  })

  it('uses classic for auto on non-WeChat platforms', () => {
    expect(resolveHmrRuntimeDecision({ platform: 'alipay', configured: 'auto', compileHotReLoad: true })).toEqual({
      configured: 'auto',
      reason: 'auto-non-wechat',
      runtime: 'classic',
    })
  })

  it('keeps explicit runtime settings authoritative outside Skyline', () => {
    expect(resolveHmrRuntime({ platform: 'weapp', configured: 'classic', compileHotReLoad: true })).toBe('classic')
    expect(resolveHmrRuntime({ platform: 'weapp', configured: 'stateful-experimental', compileHotReLoad: false })).toBe('stateful-experimental')
  })

  it.each(['auto', 'classic', 'stateful-experimental', undefined] as const)('forces classic for Skyline (%s)', (configured) => {
    expect(resolveHmrRuntimeDecision({
      platform: 'weapp',
      configured,
      compileHotReLoad: true,
      skyline: true,
    })).toEqual({
      configured: configured ?? 'auto',
      reason: 'skyline-fallback',
      runtime: 'classic',
    })
  })

  it('explains the auto stateful selection and how to switch to classic', () => {
    const decision = resolveHmrRuntimeDecision({
      platform: 'weapp',
      configured: 'auto',
      compileHotReLoad: true,
    })
    expect(formatHmrRuntimeStartupMessages(decision)).toEqual([
      'HMR 模式：stateful-experimental（自动检测：微信开发者工具热重载已开启）',
      'HMR 切换：关闭微信开发者工具“热重载”后重启 wv dev，或通过 weapp.hmr.runtime 显式配置。',
    ])
  })

  it('explains the auto classic selection and how to switch to stateful HMR', () => {
    const decision = resolveHmrRuntimeDecision({
      platform: 'weapp',
      compileHotReLoad: false,
    })
    expect(formatHmrRuntimeStartupMessages(decision)).toEqual([
      'HMR 模式：classic（自动检测：微信开发者工具热重载未开启或无法确认）',
      'HMR 切换：开启微信开发者工具“热重载”后重启 wv dev，或通过 weapp.hmr.runtime 显式配置。',
    ])
  })

  it('explains explicit, non-WeChat, and Skyline selections', () => {
    const explicit = resolveHmrRuntimeDecision({
      platform: 'weapp',
      configured: 'classic',
      compileHotReLoad: true,
    })
    expect(formatHmrRuntimeStartupMessages(explicit)[1]).toContain('auto 或 stateful-experimental')

    const nonWeChat = resolveHmrRuntimeDecision({
      platform: 'alipay',
      configured: 'auto',
      compileHotReLoad: true,
    })
    expect(formatHmrRuntimeStartupMessages(nonWeChat)).toEqual([
      'HMR 模式：classic（自动检测：仅微信小程序支持 stateful-experimental）',
      'HMR 切换：可通过 weapp.hmr.runtime 显式配置 classic。',
    ])

    const skyline = resolveHmrRuntimeDecision({
      platform: 'weapp',
      configured: 'stateful-experimental',
      skyline: true,
    })
    expect(formatHmrRuntimeStartupMessages(skyline)[0]).toContain('Skyline')
  })
})

describe('findSkylineRendererFiles', () => {
  it('finds app, page, and subpackage Skyline json assets', () => {
    expect(findSkylineRendererFiles([
      {
        type: 'asset',
        fileName: 'app.json',
        source: JSON.stringify({
          pages: ['pages/home/index', 'pages/skyline/index'],
          renderer: 'skyline',
          subPackages: [{ root: 'package-a', pages: ['pages/index'] }],
        }),
      },
      { type: 'asset', fileName: 'pages/home/index.json', source: JSON.stringify({ renderer: 'webview' }) },
      { type: 'asset', fileName: 'pages/skyline/index.json', source: new TextEncoder().encode(JSON.stringify({ renderer: 'skyline' })) },
      { type: 'asset', fileName: 'package-a\\pages\\index.json', source: JSON.stringify({ renderer: 'skyline' }) },
    ])).toEqual([
      'app.json',
      'pages/skyline/index.json',
      'package-a/pages/index.json',
    ])
  })

  it('ignores WebView, non-page json, missing renderer, invalid json, and non-json output', () => {
    expect(findSkylineRendererFiles([
      { type: 'asset', fileName: 'app.json', source: JSON.stringify({ pages: ['pages/index/index'], renderer: 'webview' }) },
      { type: 'asset', fileName: 'pages/index/index.json', source: '{}' },
      { type: 'asset', fileName: 'pages/broken/index.json', source: '{invalid' },
      { type: 'asset', fileName: 'data/renderer.json', source: JSON.stringify({ renderer: 'skyline' }) },
      { type: 'asset', fileName: 'app.js', source: JSON.stringify({ renderer: 'skyline' }) },
      { type: 'chunk', fileName: 'page.json', source: JSON.stringify({ renderer: 'skyline' }) },
    ])).toEqual([])
  })

  it('requires an emitted app config to identify page json assets', () => {
    expect(findSkylineRendererFiles([
      { type: 'asset', fileName: 'pages/index/index.json', source: JSON.stringify({ renderer: 'skyline' }) },
    ])).toEqual([])
  })
})
