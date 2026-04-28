import { defineConfig } from 'weapp-vite'
import { requestClientsRealDevPlugin } from '../../e2e/utils/requestClientsRealDevPlugin'

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
  let devSetup: Awaited<ReturnType<typeof requestClientsRealDevPlugin>> | null = null

  if (env.command === 'serve') {
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
