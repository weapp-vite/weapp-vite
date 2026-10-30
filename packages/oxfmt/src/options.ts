import type { FormatConfig } from 'vite-plus/fmt'

export const formatOptions = {
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  semi: false,
  trailingComma: 'all',
  endOfLine: 'lf',
  insertFinalNewline: true,
  htmlWhitespaceSensitivity: 'strict',
  sortImports: false,
  sortPackageJson: false,
  sortTailwindcss: false,
} satisfies FormatConfig
