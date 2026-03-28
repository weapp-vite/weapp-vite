import { describe, expect, it } from 'vitest'
import {
  normalizePattern,
  resolveExcludePatterns,
  resolveIncludePatterns,
} from './patterns'

describe('styleEntries patterns', () => {
  it('normalizes subpackage rooted, dot-prefixed and directory patterns', () => {
    expect(normalizePattern(' packages/order/components/button ', 'packages/order')).toBe('components/button')
    expect(normalizePattern('./components/button', 'packages/order')).toBe('components/button')
    expect(normalizePattern('/components/', 'packages/order')).toBe('components/**')
    expect(normalizePattern('   ', 'packages/order')).toBeUndefined()
  })

  it('resolves include patterns with normalization and dedupe', () => {
    expect(resolveIncludePatterns({
      scope: 'all',
      include: [
        'packages/order/components/**',
        './components/**',
        '/components/**',
      ],
    }, 'packages/order')).toEqual(['components/**'])
  })

  it('falls back to default include patterns by scope', () => {
    expect(resolveIncludePatterns({ scope: 'pages' }, 'packages/order')).toEqual(['pages/**'])
    expect(resolveIncludePatterns({ scope: 'components' }, 'packages/order')).toEqual(['components/**'])
  })

  it('resolves exclude patterns with normalization and dedupe', () => {
    expect(resolveExcludePatterns({
      exclude: [
        'packages/order/components/internal/**',
        './components/internal/**',
      ],
    }, 'packages/order')).toEqual(['components/internal/**'])
  })
})
