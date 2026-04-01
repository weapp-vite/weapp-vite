import { describe, expect, it } from 'vitest'
import {
  createInjectRequestGlobalsCode,
  createInjectRequestGlobalsSfcCode,
  injectRequestGlobalsIntoSfc,
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
    expect(createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest'])).toContain('weapp-vite/requestGlobals')
    expect(createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest'])).toContain('"XMLHttpRequest"')
  })

  it('can create local binding injection code for script modules', () => {
    const code = createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest'], {
      localBindings: true,
    })

    expect(code).toContain('__weappViteRequestGlobalsHost__')
    expect(code).toContain('var fetch = __weappViteRequestGlobalsHost__.fetch')
    expect(code).toContain('var URL = __weappViteRequestGlobalsHost__.URL')
  })

  it('can create a valid sfc injection block', () => {
    const code = createInjectRequestGlobalsSfcCode(['fetch'], {
      localBindings: true,
    })

    expect(code).toContain('<script lang="ts">')
    expect(code).toContain('installRequestGlobals')
    expect(code).toContain('var fetch = __weappViteRequestGlobalsHost__.fetch')
    expect(code).toContain('</script>')
  })

  it('injects into existing normal script before falling back to a new block', () => {
    const code = injectRequestGlobalsIntoSfc(
      [
        '<script setup lang="ts">',
        'defineAppJson({ pages: [] })',
        '</script>',
        '<script lang="ts">',
        'export default {}',
        '</script>',
      ].join('\n'),
      ['fetch'],
    )

    expect(code.match(/<script\b/g)?.length).toBe(2)
    expect(code).toContain('<script lang="ts">import { installRequestGlobals')
    expect(code).toContain('export default {}')
  })

  it('injects into existing script setup when no normal script exists', () => {
    const code = injectRequestGlobalsIntoSfc(
      [
        '<script setup lang="ts">',
        'const value = 1',
        '</script>',
      ].join('\n'),
      ['fetch'],
      {
        localBindings: true,
      },
    )

    expect(code.match(/<script\b/g)?.length).toBe(1)
    expect(code).toContain('<script setup lang="ts">import { installRequestGlobals')
    expect(code).toContain('var fetch = __weappViteRequestGlobalsHost__.fetch')
  })
})
