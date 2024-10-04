import type { WatchOptions } from './types'

export const defaultExcluded: string[] = ['**/node_modules/**', '**/miniprogram_npm/**']

export function getWeappWatchOptions(): WatchOptions {
  return {
    // '**/*.{wxml,json,wxs}', '**/*.{png,jpg,jpeg,gif,svg,webp}',
    paths: ['.env', '.env.*'],
    ignored: [
      ...defaultExcluded,
    ],
  }
}
