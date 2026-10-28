import { expectError } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

defineConfig({
  weapp: {
    appPrelude: {
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
      },
    },
  },
})

expectError(defineConfig({ weapp: { appPrelude: { webRuntime: { targets: ['SSE'] } } } }))
expectError(defineConfig({ weapp: { appPrelude: { webRuntime: { networkDefaults: { request: { enableChunked: 'true' } } } } } }))
