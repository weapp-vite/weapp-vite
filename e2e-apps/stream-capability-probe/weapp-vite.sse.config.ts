import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: {
      enabled: true,
      include: [/^pages\/(?:index|sse)\/index$/],
    },
    appPrelude: {
      webRuntime: {
        targets: ['fetch', 'Headers', 'Request', 'Response', 'AbortController', 'AbortSignal', 'ReadableStream', 'WritableStream', 'TransformStream', 'TextDecoder', 'TextDecoderStream', 'EventSource'],
        networkDefaults: { request: { enableChunked: true } },
      },
    },
  },
})
