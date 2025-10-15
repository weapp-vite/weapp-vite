import type { MpPlatform, WeappViteConfig } from './types'

export const defaultExcluded: string[] = [
  '**/node_modules/**',
  '**/miniprogram_npm/**',
]

export interface OutputExtensions {
  js: string
  json: string
  wxml: string
  wxss: string
  wxs?: string
}

/**
 * wxss 微信小程序
 * acss 支付宝小程序
 * jxss 京东小程序
 * ttss 头条小程序
 * qss QQ小程序
 * css 最正常的样式文件
 * tyss 涂鸦小程序
 */

/**
 * wxml 微信小程序
 * axml 支付宝小程序
 * jxml 京东小程序
 * ksml 快手小程序
 * ttml 头条小程序
 * qml QQ小程序
 * tyml 涂鸦小程序
 * xhsml 小红书小程序
 * swan 百度小程序
 */

export function getOutputExtensions(platform?: MpPlatform): OutputExtensions {
  switch (platform) {
    // https://opendocs.alipay.com/mini/0ai07p?pathHash=01051631
    // Native 渲染
    case 'alipay': {
      return {
        js: 'js',
        json: 'json',
        wxml: 'axml',
        wxss: 'acss',
        wxs: 'sjs',
      }
    }
    case 'tt': {
      return {
        js: 'js',
        json: 'json',
        wxml: 'ttml',
        wxss: 'ttss',
        // tt 没有 wxs
        //  wxs: 'wxs',
      }
    }
    case 'weapp':
    default: {
      return {
        js: 'js',
        json: 'json',
        wxml: 'wxml',
        wxss: 'wxss',
        wxs: 'wxs',
      }
    }
  }
}

export function getWeappViteConfig(): WeappViteConfig {
  return {
    autoRoutes: false,
    wxml: true,
    wxs: true,
    enhance: {
      wxml: true,
      wxs: true,
    },
    platform: 'weapp',
    es5: false,
    jsFormat: 'cjs',
    isAdditionalWxml: () => {
      return false
    },
    npm: {
      enable: true,
      cache: true,
    },
  }
}

export const defaultAssetExtensions = [
  // 给 wxs 单独处理，用来自动分析 wxs，去除无用的 wxs
  // 'wxs',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'cer',
  'mp3',
  'aac',
  'm4a',
  'mp4',
  'wav',
  'ogg',
  'silk',
  'wasm',
  'br',
  'cert',
]
