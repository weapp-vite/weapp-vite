import type { WebRuntimeInstallContext } from 'weapp-vite/web-apis/installers'
import { expectError, expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'
import { createWebRuntimeInstallContext, installWebRuntimeFetch } from 'weapp-vite/web-apis/installers'

expectType<WebRuntimeInstallContext>(createWebRuntimeInstallContext())
expectType<void>(installWebRuntimeFetch(createWebRuntimeInstallContext()))

defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      webRuntime: {
        targets: [
          'fetch',
          'EventSource',
          'TextDecoderStream',
          'ReadableStream',
          'WritableStream',
          'TransformStream',
        ],
        networkDefaults: { request: { enableChunked: true } },
        globalTargets: ['fetch', 'Headers'],
      },
    },
  },
})

defineConfig({
  weapp: {
    appPrelude: {
      enabled: false,
      mode: 'native',
      webRuntime: {
        targets: ['fetch'],
      },
    },
  },
})

defineConfig({
  weapp: {
    injectWebRuntimeGlobals: {
      targets: ['fetch'],
      prelude: true,
    },
    appPrelude: {
      mode: 'native',
      webRuntime: {
        targets: ['Headers'],
      },
    },
  },
})

defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      requestRuntime: {
        targets: ['WebSocket'],
        networkDefaults: { socket: { timeout: 4200 } },
      },
    },
  },
})

defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      webRuntime: {
        targets: ['fetch'],
        globalTargets: ['fetch'],
      },
    },
  },
})

defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      webRuntime: {
        globalTargets: ['File', 'URLSearchParams'],
      },
    },
  },
})

expectError(defineConfig({ weapp: { appPrelude: { mode: 'automatic' } } }))
expectError(defineConfig({ weapp: { appPrelude: { mode: 'native', webRuntime: { install: 'shim' } } } }))
expectError(defineConfig({ weapp: { appPrelude: { mode: 'native', webRuntime: { prelude: true } } } }))
expectError(defineConfig({ weapp: { appPrelude: { mode: 'native', webRuntime: { dependencies: { axios: '*' } } } } }))
expectError(defineConfig({ weapp: { appPrelude: { mode: 'native', webRuntime: { method: 'hybrid' } } } }))
expectError(defineConfig({ weapp: { injectWebRuntimeGlobals: { globalTargets: ['fetch'] } } }))
expectError(defineConfig({ weapp: { appPrelude: { webRuntime: { prelude: false } } } }))
expectError(defineConfig({ weapp: { appPrelude: { mode: 'inline', webRuntime: { prelude: false } } } }))
expectError(defineConfig({ weapp: { appPrelude: { mode: 'entry', webRuntime: { prelude: false } } } }))
expectError(defineConfig({ weapp: { appPrelude: { mode: 'require', webRuntime: { prelude: false } } } }))
expectError(defineConfig({ weapp: { appPrelude: { requestRuntime: { prelude: false } } } }))
expectError(defineConfig({ weapp: { appPrelude: { mode: 'inline', requestRuntime: { prelude: false } } } }))
expectError(defineConfig({ weapp: { appPrelude: { webRuntime: { targets: ['SSE'] } } } }))
expectError(defineConfig({ weapp: { appPrelude: { webRuntime: { networkDefaults: { request: { enableChunked: 'true' } } } } } }))
