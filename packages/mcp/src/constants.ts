import path from 'node:path'

export const MCP_SERVER_NAME = '@weapp-vite/mcp'
export const MCP_SERVER_VERSION = '2.0.0'

export const EXPOSED_PACKAGES = {
  'weapp-vite': {
    id: 'weapp-vite',
    label: 'weapp-vite',
    relativePath: path.join('packages', 'weapp-vite'),
  },
  'wevu': {
    id: 'wevu',
    label: 'wevu',
    relativePath: path.join('packages', 'wevu'),
  },
  'wevu-compiler': {
    id: 'wevu-compiler',
    label: 'wevu-compiler',
    relativePath: path.join('packages', 'wevu-compiler'),
  },
} as const

export type ExposedPackageId = keyof typeof EXPOSED_PACKAGES

export const DEFAULT_TIMEOUT_MS = 120_000
export const DEFAULT_MAX_OUTPUT_CHARS = 120_000
export const DEFAULT_MAX_FILE_CHARS = 80_000
export const DEFAULT_MAX_RESULTS = 200

export const SKIPPED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'coverage',
])
