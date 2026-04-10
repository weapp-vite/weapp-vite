import { describe, expect, it } from 'vitest'
import {
  createInjectRequestGlobalsCode,
  createInjectRequestGlobalsSfcCode,
  injectRequestGlobalsIntoSfc,
  resolveInjectRequestGlobalsOptions,
  resolveManualRequestGlobalsTargets,
} from './injectRequestGlobals'

describe('injectRequestGlobals helpers', () => {
  it('enables auto injection when matching dependencies are present', () => {
    expect(resolveInjectRequestGlobalsOptions(undefined, {
      dependencies: {
        axios: '^1.0.0',
      },
    })).toEqual({
      mode: 'auto',
      prelude: false,
      targets: [
        'fetch',
        'Headers',
        'Request',
        'Response',
        'AbortController',
        'AbortSignal',
        'XMLHttpRequest',
        'WebSocket',
      ],
    })
  })

  it('enables auto injection for socket.io-client projects', () => {
    expect(resolveInjectRequestGlobalsOptions(undefined, {
      dependencies: {
        'socket.io-client': '^4.8.3',
      },
    })).toEqual({
      mode: 'auto',
      prelude: false,
      targets: [
        'fetch',
        'Headers',
        'Request',
        'Response',
        'AbortController',
        'AbortSignal',
        'XMLHttpRequest',
        'WebSocket',
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
      prelude: false,
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
      dependencyPatterns: ['axios', 'graphql-request', 'socket.io-client', 'engine.io-client'],
      prelude: false,
      targets: ['fetch', 'AbortController'],
    })
  })

  it('creates stable injection code', () => {
    expect(createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest', 'WebSocket'])).toContain('installRequestGlobals')
    expect(createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest', 'WebSocket'])).toContain('weapp-vite/web-apis')
    expect(createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest', 'WebSocket'])).toContain('"XMLHttpRequest"')
    expect(createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest', 'WebSocket'])).toContain('"WebSocket"')
  })

  it('can create local binding injection code for script modules', () => {
    const code = createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest', 'WebSocket'], {
      localBindings: true,
    })

    expect(code).toContain('__weappViteRequestGlobalsHost__')
    expect(code).toContain('var fetch = __weappViteRequestGlobalsHost__.fetch')
    expect(code).toContain('var URL = __weappViteRequestGlobalsHost__.URL')
    expect(code).toContain('var WebSocket = __weappViteRequestGlobalsHost__.WebSocket')
  })

  it('can create passive local binding injection code for manual installers', () => {
    const code = createInjectRequestGlobalsCode(['fetch', 'AbortController'], {
      passiveLocalBindings: true,
    })

    expect(code).toContain('__weappViteRequestGlobalsPassiveBindings__')
    expect(code).toContain('function __weappViteExposeRequestGlobal__(name,value)')
    expect(code).toContain('var fetch = __weappViteExposeRequestGlobal__("fetch",typeof __weappViteRequestGlobalsActuals__["fetch"]==="function"')
    expect(code).toContain('var URL = __weappViteExposeRequestGlobal__("URL",__weappViteHasUsableRequestGlobalsConstructor__')
    expect(code).not.toContain('import { installRequestGlobals')
  })

  it('keeps free-variable bindings for request libraries instead of relying on app-level globals only', () => {
    const code = createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest', 'WebSocket'], {
      passiveLocalBindings: true,
    })

    expect(code).toContain('var fetch = __weappViteExposeRequestGlobal__("fetch"')
    expect(code).toContain('var XMLHttpRequest = __weappViteExposeRequestGlobal__("XMLHttpRequest"')
    expect(code).toContain('var WebSocket = __weappViteExposeRequestGlobal__("WebSocket"')
    expect(code).toContain('var URL = __weappViteExposeRequestGlobal__("URL"')
    expect(code).not.toContain('__weappViteRequestGlobalsHost__.fetch')
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

  it('detects manual installRequestGlobals usage from web-apis imports', () => {
    expect(resolveManualRequestGlobalsTargets([
      'import { installRequestGlobals } from "@wevu/web-apis"',
      'installRequestGlobals()',
    ].join('\n'))).toEqual([
      'fetch',
      'Headers',
      'Request',
      'Response',
      'AbortController',
      'AbortSignal',
      'XMLHttpRequest',
      'WebSocket',
    ])
  })

  it('detects manual installAbortGlobals usage from compatibility imports', () => {
    expect(resolveManualRequestGlobalsTargets([
      'import { installAbortGlobals } from "weapp-vite/web-apis"',
      'installAbortGlobals()',
    ].join('\n'))).toEqual([
      'AbortController',
      'AbortSignal',
    ])
  })
})
