import { describe, expect, it } from 'vitest'
import {
  createInjectRequestGlobalsCode,
  resolveInjectRequestGlobalsOptions,
} from './injectRequestGlobals'

describe('injectRequestGlobals helpers', () => {
  it('enables auto injection when matching dependencies are present', () => {
    expect(resolveInjectRequestGlobalsOptions(undefined, {
      dependencies: {
        axios: '^1.0.0',
      },
    })).toEqual({
      mode: 'auto',
      targets: [
        'fetch',
        'Headers',
        'Request',
        'Response',
        'AbortController',
        'AbortSignal',
        'XMLHttpRequest',
      ],
    })
  })

  it('resolves abort-only auto injection for tanstack query dependencies', () => {
    expect(resolveInjectRequestGlobalsOptions(undefined, {
      dependencies: {
        '@tanstack/vue-query': '^5.0.0',
      },
    })).toEqual({
      mode: 'auto',
      targets: [
        'AbortController',
        'AbortSignal',
      ],
    })
  })

  it('does not inject when no matching dependency exists in auto mode', () => {
    expect(resolveInjectRequestGlobalsOptions(undefined, {
      dependencies: {
        dayjs: '^1.0.0',
      },
    })).toBeNull()
  })

  it('supports explicit enable with custom targets', () => {
    expect(resolveInjectRequestGlobalsOptions({
      enabled: true,
      targets: ['fetch', 'AbortController'],
    }, {
      dependencies: {
        dayjs: '^1.0.0',
      },
    })).toEqual({
      mode: 'explicit',
      dependencyPatterns: ['axios', 'graphql-request'],
      targets: ['fetch', 'AbortController'],
    })
  })

  it('creates stable injection code', () => {
    expect(createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest'])).toContain('installRequestGlobals')
    expect(createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest'])).toContain('"XMLHttpRequest"')
  })
})
