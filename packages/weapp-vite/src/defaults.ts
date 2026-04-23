import type { OutputExtensions } from './platforms/types'
import type { MpPlatform, WeappViteConfig } from './types'
import { DEFAULT_MP_PLATFORM, getPlatformOutputExtensions } from './platform'

export const defaultExcluded: string[] = [
  '**/node_modules/**',
  '**/miniprogram_npm/**',
  '**/.weapp-vite',
  '**/.weapp-vite/**',
]

/**
 * 样式扩展名说明：
 * - wxss：微信小程序
 * - acss：支付宝小程序
 * - jxss：京东小程序
 * - ttss：头条小程序
 * - qss：QQ 小程序
 * - css：通用样式文件
 * - tyss：涂鸦小程序
 */

/**
 * 模板扩展名说明：
 * - wxml：微信小程序
 * - axml：支付宝小程序
 * - jxml：京东小程序
 * - ksml：快手小程序
 * - ttml：头条小程序
 * - qml：QQ 小程序
 * - tyml：涂鸦小程序
 * - xhsml：小红书小程序
 * - swan：百度小程序
 */

export function getOutputExtensions(platform?: MpPlatform): OutputExtensions {
  const target = platform ?? DEFAULT_MP_PLATFORM
  return getPlatformOutputExtensions(target)
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
    platform: DEFAULT_MP_PLATFORM,
    multiPlatform: false,
    // 已废弃：保留默认关闭，仅兼容旧配置。
    es5: false,
    packageSizeWarningBytes: 2 * 1024 * 1024,
    jsFormat: 'cjs',
    isAdditionalWxml: () => {
      return false
    },
    npm: {
      enable: true,
      cache: true,
      alipayNpmMode: 'node_modules',
    },
    hmr: {
      sharedChunks: 'auto',
      touchAppWxss: 'auto',
      profileJson: false,
    },
    mcp: {
      enabled: true,
      autoStart: false,
      host: '127.0.0.1',
      port: 3088,
      endpoint: '/mcp',
    },
    forwardConsole: {
      enabled: 'auto',
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    },
    appPrelude: {
      mode: 'require',
    },
    wevu: {
      defaults: {
        component: {
          allowNullPropInput: true,
        },
      },
    },
    chunks: {
      sharedStrategy: 'duplicate',
      sharedMode: 'common',
      sharedOverrides: [],
      sharedPathRoot: undefined,
      dynamicImports: 'preserve',
      logOptimization: true,
      forceDuplicatePatterns: [],
      duplicateWarningBytes: 512 * 1024,
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
