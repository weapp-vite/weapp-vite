import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    runtime: './src/runtime.ts',
    runtimeGlobal: './src/runtimeGlobal.ts',
    runtimeEnsure: './src/runtimeEnsure.ts',
    installers: './src/installers.ts',
    abort: './src/abort.ts',
    fetch: './src/fetch.ts',
    streams: './src/streams.ts',
    eventsource: './src/eventsource.ts',
    http: './src/http.ts',
    networkDefaults: './src/networkDefaults.ts',
    shared: './src/shared.ts',
    url: './src/url.ts',
    web: './src/web.ts',
    websocket: './src/websocket.ts',
    xhr: './src/xhr.ts',
  },
  dts: true,
  clean: true,
  format: ['esm'],
  shims: true,
  outExtensions() {
    return {
      js: '.mjs',
    }
  },
  // 轻量目标独立成块，避免自动共享 chunk 把 atob/crypto/performance 等无关实现带入单目标产物。
  outputOptions: {
    codeSplitting: {
      groups: [
        ...['base64', 'crypto', 'performance', 'task'].map(name => ({
          name,
          test: new RegExp(`[\\\\/]src[\\\\/]${name}\\.ts$`, 'u'),
          priority: 10,
        })),
        {
          name: 'runtime-globals',
          test: /[\\/]src[\\/]globalValue\.ts$|[\\/]platforms[\\/]runtime[\\/]globalKeys\.(?:ts|js)$/u,
          priority: 20,
        },
      ],
    },
  },
  env: {
    NODE_ENV: 'production',
  },
  deps: {
    resolveDepSubpath: true,
  },
  target: 'node20',
  failOnWarn: false,
})
