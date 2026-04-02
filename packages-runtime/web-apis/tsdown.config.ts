import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    abort: './src/abort.ts',
    fetch: './src/fetch.ts',
    http: './src/http.ts',
    shared: './src/shared.ts',
    url: './src/url.ts',
    web: './src/web.ts',
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
  env: {
    NODE_ENV: 'production',
  },
  target: 'node20',
  failOnWarn: false,
})
