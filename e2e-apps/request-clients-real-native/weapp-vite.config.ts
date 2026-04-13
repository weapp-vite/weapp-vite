import { defineConfig } from 'weapp-vite'
import { requestClientsRealDevPlugin } from '../../e2e/utils/requestClientsRealDevPlugin'

export default defineConfig(async (env) => {
  const devSetup = env.command === 'serve'
    ? await requestClientsRealDevPlugin({
        projectRoot: import.meta.dirname,
        serverPort: 60323,
      })
    : null

  return {
    plugins: devSetup ? [devSetup.plugin] : [],
    weapp: {
      appPrelude: {
        webRuntime: true,
      },
      srcRoot: 'src',
    },
  }
})
