import type { RuntimeProvider } from './types'
import { fileURLToPath } from 'node:url'
import { WEAPP_VITE_RUNTIME_CONTRACT_VERSION } from '@weapp-core/constants'

const noFrameworkEntries = Object.freeze({})

export const nativeMiniprogramRuntimeProvider: RuntimeProvider = {
  descriptor: {
    id: 'native-miniprogram',
    backend: 'miniprogram',
    compilation: 'native',
    injection: 'none',
    entries: noFrameworkEntries,
    capabilities: Object.freeze({
      framework: false,
      hmr: false,
      nativeHost: true,
      webHost: false,
    }),
    hmr: Object.freeze({ mode: 'none' }),
    contractVersion: WEAPP_VITE_RUNTIME_CONTRACT_VERSION,
  },
}

export const wevuMiniprogramRuntimeProvider: RuntimeProvider = {
  descriptor: {
    id: 'wevu-miniprogram',
    backend: 'miniprogram',
    compilation: 'vue',
    injection: 'virtual-module',
    entries: Object.freeze({
      runtime: Object.freeze({
        development: 'wevu/internal-runtime',
        production: 'wevu/internal-runtime',
      }),
      reactivity: Object.freeze({
        development: 'wevu/internal-reactivity',
        production: 'wevu/internal-reactivity',
      }),
      template: Object.freeze({
        development: 'wevu/internal-template',
        production: 'wevu/internal-template',
      }),
    }),
    capabilities: Object.freeze({
      framework: true,
      hmr: true,
      nativeHost: true,
      webHost: false,
    }),
    hmr: Object.freeze({ mode: 'host-reload' }),
    contractVersion: WEAPP_VITE_RUNTIME_CONTRACT_VERSION,
  },
}

export const webRuntimeProvider: RuntimeProvider = {
  descriptor: {
    id: 'web-runtime',
    backend: 'web',
    compilation: 'web',
    injection: 'virtual-module',
    entries: Object.freeze({
      runtime: Object.freeze({
        development: '@weapp-vite/web/runtime',
        production: '@weapp-vite/web/runtime',
      }),
    }),
    capabilities: Object.freeze({
      framework: false,
      hmr: true,
      nativeHost: false,
      webHost: true,
    }),
    hmr: Object.freeze({
      mode: 'module-accept',
      acceptCode: 'if (import.meta.hot) { import.meta.hot.accept() }',
    }),
    contractVersion: WEAPP_VITE_RUNTIME_CONTRACT_VERSION,
  },
  resolveModuleId(entry) {
    return fileURLToPath(import.meta.resolve(entry.moduleId))
  },
}
