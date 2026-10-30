import type { OxfmtConfig } from 'vite-plus/fmt'
import { formatOptions } from './options'

/** 小程序格式预设；WXML 交给安全适配器，样式语义仍交给 Stylelint。 */
export const recommended = {
  ...formatOptions,
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/dist-*/**',
    '**/.weapp-vite/**',
    '**/miniprogram_npm/**',
    '**/generated/**',
    '**/pnpm-lock.yaml',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/*.wxml',
  ],
  associations: [
    { files: ['**/*.wxss'], language: 'css' },
  ],
} satisfies OxfmtConfig
