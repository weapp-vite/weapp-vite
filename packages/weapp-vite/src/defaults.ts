import type { MpPlatform, WeappViteConfig } from './types'

export const defaultExcluded: string[] = ['**/node_modules/**', '**/miniprogram_npm/**']

export interface OutputExtensions {
  js: string
  json: string
  wxml: string
  wxss: string
  wxs?: string
}

export function getOutputExtensions(_platform?: MpPlatform): OutputExtensions {
  return {
    js: 'js',
    json: 'json',
    wxml: 'wxml',
    wxss: 'wxss',
    wxs: 'wxs',
  }
}

export function getWeappViteConfig(): WeappViteConfig {
  return {
    enhance: {
      wxml: true,
      wxs: true,
    },
  }
}
