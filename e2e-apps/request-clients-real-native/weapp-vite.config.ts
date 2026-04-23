import { defineConfig } from 'weapp-vite'

const REQUEST_CLIENTS_REAL_NETWORK_DEFAULTS = {
  request: {
    timeout: 4_321,
  },
  socket: {
    perMessageDeflate: false,
    timeout: 6_789,
  },
} as const

export default defineConfig(async (env) => {
  let devSetup: Awaited<ReturnType<typeof import('../../e2e/utils/requestClientsRealDevPlugin').requestClientsRealDevPlugin>> | null = null

  if (env.command === 'serve') {
    const { requestClientsRealDevPlugin } = await import('../../e2e/utils/requestClientsRealDevPlugin')
    devSetup = await requestClientsRealDevPlugin({
      projectRoot: import.meta.dirname,
      serverPort: 60323,
    })
  }

  return {
    plugins: devSetup ? [devSetup.plugin] : [],
    weapp: {
      appPrelude: {
        webRuntime: {
          networkDefaults: REQUEST_CLIENTS_REAL_NETWORK_DEFAULTS,
        },
      },
      srcRoot: 'src',
    },
  }
})
