import type { OxfmtConfig } from 'vite-plus/fmt'
import { FILTER_EXTENSIONS, SCRIPT_EXTENSIONS, STYLE_EXTENSIONS, TEMPLATE_EXTENSIONS } from '@weapp-vite/language-service'
import { formatOptions } from './options'

export const nativeFormatIgnorePatterns = [
  ...FILTER_EXTENSIONS.map(extension => `**/*${extension}`),
  ...TEMPLATE_EXTENSIONS.map(extension => `**/*${extension}`),
  ...SCRIPT_EXTENSIONS.flatMap(extension => [`**/*${extension}`, `**/*${extension}.ts`, `**/*${extension}.js`]),
]

/** 小程序格式预设；原生模板和模块交给安全适配器，样式语义仍交给 Stylelint。 */
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
    ...nativeFormatIgnorePatterns,
  ],
  associations: [
    { files: STYLE_EXTENSIONS.map(extension => `**/*${extension}`), language: 'css' },
  ],
} satisfies OxfmtConfig
