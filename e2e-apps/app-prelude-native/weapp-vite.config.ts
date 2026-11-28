import type { WeappInjectWebRuntimeGlobalsTarget } from 'weapp-vite'
import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const appPreludeMode = process.env.APP_PRELUDE_MODE === 'inline'
  || process.env.APP_PRELUDE_MODE === 'entry'
  || process.env.APP_PRELUDE_MODE === 'require'
  || process.env.APP_PRELUDE_MODE === 'native'
  ? process.env.APP_PRELUDE_MODE
  : 'require'
const requestGlobalsPreludeEnabled = process.env.APP_PRELUDE_REQUEST_GLOBALS === '1'
const legacyEs5MinifyEnabled = process.env.APP_PRELUDE_ES5_MINIFY === '1'
const nativeFetchOverride = appPreludeMode === 'native' && process.env.APP_PRELUDE_NATIVE_FETCH_OVERRIDE === '1'
const nativeTargets: WeappInjectWebRuntimeGlobalsTarget[] = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
  'WebSocket',
  'atob',
  'btoa',
  'queueMicrotask',
  'performance',
  'crypto',
  'Event',
  'CustomEvent',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'TextDecoderStream',
  'EventSource',
]

export default defineConfig({
  build: {
    ...(legacyEs5MinifyEnabled ? { minify: true } : {}),
    ...(nativeFetchOverride
      ? {
          rolldownOptions: {
            transform: {
              inject: {
                fetch: ['virtual:app-prelude-native-fetch', 'nativeFetch'],
              },
            },
          },
        }
      : {}),
  },
  plugins: nativeFetchOverride
    ? [{
        name: 'app-prelude-native-fetch-override',
        resolveId(id: string) {
          return id === 'virtual:app-prelude-native-fetch' ? id : null
        },
        load(id: string) {
          if (id === 'virtual:app-prelude-native-fetch') {
            return {
              code: `export async function nativeFetch() { return { ok: true, json: async () => ({ transport: 'native-override' }) } }`,
              moduleSideEffects: true,
            }
          }
          return null
        },
      }]
    : [],
  weapp: {
    es5: legacyEs5MinifyEnabled,
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    appPrelude: {
      mode: appPreludeMode,
      webRuntime: requestGlobalsPreludeEnabled
        ? {
            enabled: true,
            targets: appPreludeMode === 'native' ? nativeTargets : ['fetch', 'Headers', 'Request', 'Response'],
            ...(appPreludeMode === 'native'
              ? {
                  globalTargets: ['fetch', 'Request', 'Response'],
                  networkDefaults: {
                    request: {
                      timeout: 4800,
                      enableHttp2: true,
                      enableChunked: true,
                    },
                    socket: {
                      timeout: 4600,
                      perMessageDeflate: false,
                      header: { 'x-native-default': 'socket' },
                    },
                  },
                }
              : {}),
          }
        : undefined,
    },
    chunks: {
      sharedStrategy: 'common',
    },
  },
})
