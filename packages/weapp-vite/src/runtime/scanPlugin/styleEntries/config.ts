import type { SubPackageStyleConfigEntry, SubPackageStyleScope } from '../../../types'
import logger from '../../../logger'

export const SUPPORTED_SHARED_STYLE_EXTENSIONS = [
  '.wxss',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.styl',
  '.stylus',
  '.pcss',
  '.postcss',
  '.sss',
]
export const SUPPORTED_SHARED_STYLE_EXTS = new Set(SUPPORTED_SHARED_STYLE_EXTENSIONS)

export interface ResolvedStyleConfig {
  source: string
  scope: SubPackageStyleScope
  include?: string | string[]
  exclude?: string | string[]
  explicitScope: boolean
}

export const DEFAULT_SCOPE_INCLUDES: Record<SubPackageStyleScope, string[]> = {
  all: ['**/*'],
  pages: ['pages/**'],
  components: ['components/**'],
}

export const DEFAULT_SCOPED_FILES: Array<{ base: string, scope: SubPackageStyleScope }> = [
  { base: 'index', scope: 'all' },
  { base: 'pages', scope: 'pages' },
  { base: 'components', scope: 'components' },
]

export const DEFAULT_SCOPED_EXTENSIONS = Array.from(SUPPORTED_SHARED_STYLE_EXTS)

export function coerceScope(scope: unknown): SubPackageStyleScope {
  const value = typeof scope === 'string' ? scope.trim() : ''
  if (value === 'pages' || value === 'components') {
    return value
  }
  if (value && value !== 'all') {
    logger.warn(`[分包] 未识别的样式作用域 \`${value}\`，已按 \`all\` 处理。`)
  }
  return 'all'
}

export function coerceStyleConfig(entry: SubPackageStyleConfigEntry): ResolvedStyleConfig | undefined {
  if (typeof entry === 'string') {
    const source = entry.trim()
    if (!source) {
      return undefined
    }
    return {
      source,
      scope: 'all',
      explicitScope: false,
    }
  }

  if (!entry || typeof entry !== 'object') {
    return undefined
  }

  const source = entry.source?.toString().trim()
  if (!source) {
    return undefined
  }

  const hasExplicitScope = Object.prototype.hasOwnProperty.call(entry, 'scope') && entry.scope != null
  const scope = hasExplicitScope ? coerceScope(entry.scope) : 'all'
  return {
    source,
    scope,
    include: entry.include,
    exclude: entry.exclude,
    explicitScope: hasExplicitScope,
  }
}
