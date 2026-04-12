import {
  REQUEST_GLOBAL_ACTUALS_KEY,
  REQUEST_GLOBAL_EXPOSE_HELPER,
  REQUEST_GLOBAL_INSTALLER_HOST_REF,
  REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER,
  REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER,
} from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import {
  createInjectRequestGlobalsCode,
  createInjectRequestGlobalsSfcCode,
  injectRequestGlobalsIntoSfc,
  resolveAutoRequestGlobalsTargets,
  resolveInjectRequestGlobalsOptions,
  resolveManualRequestGlobalsTargets,
  resolveRequestRuntimeOptions,
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

  it('supports appPrelude.requestRuntime with implicit prelude timing', () => {
    expect(resolveRequestRuntimeOptions({
      appPrelude: {
        requestRuntime: {},
      },
    }, {
      dependencies: {
        axios: '^1.0.0',
      },
    })).toEqual({
      mode: 'auto',
      prelude: true,
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

  it('supports appPrelude.requestRuntime boolean shorthand', () => {
    expect(resolveRequestRuntimeOptions({
      appPrelude: {
        requestRuntime: true,
      },
    }, {
      dependencies: {
        dayjs: '^1.0.0',
      },
    })).toEqual({
      mode: 'explicit',
      dependencyPatterns: ['axios', 'graphql-request', 'socket.io-client', 'engine.io-client'],
      prelude: true,
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

  it('prefers appPrelude.requestRuntime over legacy injectRequestGlobals and warns', () => {
    const warn = vi.fn()

    expect(resolveRequestRuntimeOptions({
      appPrelude: {
        requestRuntime: {
          enabled: true,
          targets: ['fetch'],
        },
      },
      injectRequestGlobals: {
        enabled: true,
        targets: ['XMLHttpRequest'],
      },
    }, {
      dependencies: {
        axios: '^1.0.0',
      },
    }, warn)).toEqual({
      mode: 'explicit',
      dependencyPatterns: ['axios', 'graphql-request', 'socket.io-client', 'engine.io-client'],
      prelude: true,
      targets: ['fetch'],
    })
    expect(warn).toHaveBeenCalledWith('`weapp.injectRequestGlobals` 已废弃，且当前会被 `weapp.appPrelude.requestRuntime` 覆盖。请迁移到 `weapp.appPrelude.requestRuntime`。')
  })

  it('keeps legacy injectRequestGlobals behavior during compatibility window and warns once', () => {
    const warn = vi.fn()

    expect(resolveRequestRuntimeOptions({
      injectRequestGlobals: {
        enabled: true,
        targets: ['fetch'],
      },
    }, {
      dependencies: {
        dayjs: '^1.0.0',
      },
    }, warn)).toEqual({
      mode: 'explicit',
      dependencyPatterns: ['axios', 'graphql-request', 'socket.io-client', 'engine.io-client'],
      prelude: false,
      targets: ['fetch'],
    })
    expect(warn).toHaveBeenCalledWith('`weapp.injectRequestGlobals` 已废弃，请迁移到 `weapp.appPrelude.requestRuntime`。')
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

    expect(code).toContain(REQUEST_GLOBAL_INSTALLER_HOST_REF)
    expect(code).toContain(`var fetch = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.fetch`)
    expect(code).toContain(`var URL = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.URL`)
    expect(code).toContain(`var WebSocket = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.WebSocket`)
  })

  it('keeps URL bindings available for websocket-only local bindings', () => {
    const code = createInjectRequestGlobalsCode(['WebSocket'], {
      localBindings: true,
    })

    expect(code).toContain(`var WebSocket = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.WebSocket`)
    expect(code).toContain(`var URL = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.URL`)
  })

  it('can create passive local binding injection code for manual installers', () => {
    const code = createInjectRequestGlobalsCode(['fetch', 'AbortController'], {
      passiveLocalBindings: true,
    })

    expect(code).toContain(REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER)
    expect(code).toContain(`function ${REQUEST_GLOBAL_EXPOSE_HELPER}(name,value)`)
    expect(code).toContain(`var fetch = ${REQUEST_GLOBAL_EXPOSE_HELPER}("fetch",typeof ${REQUEST_GLOBAL_ACTUALS_KEY}["fetch"]==="function"`)
    expect(code).toContain(`var URL = ${REQUEST_GLOBAL_EXPOSE_HELPER}("URL",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(`)
    expect(code).not.toContain('import { installRequestGlobals')
  })

  it('keeps free-variable bindings for request libraries instead of relying on app-level globals only', () => {
    const code = createInjectRequestGlobalsCode(['fetch', 'XMLHttpRequest', 'WebSocket'], {
      passiveLocalBindings: true,
    })

    expect(code).toContain(`var fetch = ${REQUEST_GLOBAL_EXPOSE_HELPER}("fetch"`)
    expect(code).toContain(`var XMLHttpRequest = ${REQUEST_GLOBAL_EXPOSE_HELPER}("XMLHttpRequest"`)
    expect(code).toContain(`var WebSocket = ${REQUEST_GLOBAL_EXPOSE_HELPER}("WebSocket"`)
    expect(code).toContain(`var URL = ${REQUEST_GLOBAL_EXPOSE_HELPER}("URL"`)
    expect(code).not.toContain(`${REQUEST_GLOBAL_INSTALLER_HOST_REF}.fetch`)
  })

  it('can create a valid sfc injection block', () => {
    const code = createInjectRequestGlobalsSfcCode(['fetch'], {
      localBindings: true,
    })

    expect(code).toContain('<script lang="ts">')
    expect(code).toContain('installRequestGlobals')
    expect(code).toContain(`var fetch = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.fetch`)
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

  it('prepends a normal script block when only script setup exists', () => {
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

    expect(code.match(/<script\b/g)?.length).toBe(2)
    expect(code).toContain('<script lang="ts">')
    expect(code).toContain('<script setup lang="ts">\nconst value = 1')
    expect(code).toContain(`var fetch = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.fetch`)
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

  it('resolves request runtime targets on demand for fetch usage in auto mode', () => {
    expect(resolveAutoRequestGlobalsTargets(
      'export async function run() { return fetch("/api") }',
      [
        'fetch',
        'Headers',
        'Request',
        'Response',
        'AbortController',
        'AbortSignal',
        'XMLHttpRequest',
        'WebSocket',
      ],
    )).toEqual([
      'fetch',
      'Headers',
      'Request',
      'Response',
      'AbortController',
      'AbortSignal',
      'XMLHttpRequest',
    ])
  })

  it('resolves websocket target on demand without request runtime group', () => {
    expect(resolveAutoRequestGlobalsTargets(
      'export const socket = new WebSocket("wss://request-globals.invalid/socket")',
      [
        'fetch',
        'Headers',
        'Request',
        'Response',
        'AbortController',
        'AbortSignal',
        'XMLHttpRequest',
        'WebSocket',
      ],
    )).toEqual([
      'WebSocket',
    ])
  })

  it('resolves socket.io-client imports to the full request runtime target set', () => {
    expect(resolveAutoRequestGlobalsTargets(
      'import { io } from "socket.io-client"\nexport const socket = io("wss://request-globals.invalid/socket")',
      [
        'fetch',
        'Headers',
        'Request',
        'Response',
        'AbortController',
        'AbortSignal',
        'XMLHttpRequest',
        'WebSocket',
      ],
    )).toEqual([
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

  it('does not treat locally shadowed globals as auto-injection usage', () => {
    expect(resolveAutoRequestGlobalsTargets(
      'const fetch = createFetch(); export { fetch }',
      [
        'fetch',
        'Headers',
        'Request',
        'Response',
        'AbortController',
        'AbortSignal',
        'XMLHttpRequest',
        'WebSocket',
      ],
    )).toEqual([])
  })
})
