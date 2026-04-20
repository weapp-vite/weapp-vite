import { defineConfig } from 'weapp-vite'
import { requestClientsRealDevPlugin } from '../../e2e/utils/requestClientsRealDevPlugin'
import { REQUEST_CLIENTS_REAL_NETWORK_DEFAULTS } from '../../e2e/utils/requestClientsRealHostTraceRuntime'

export default defineConfig(async (env) => {
  const devSetup = env.command === 'serve'
    ? await requestClientsRealDevPlugin({
        projectRoot: import.meta.dirname,
        serverPort: 60322,
      })
    : null

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
