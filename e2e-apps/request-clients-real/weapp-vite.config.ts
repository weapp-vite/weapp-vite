import { defineConfig } from 'weapp-vite'
import { requestClientsRealDevPlugin } from '../../e2e/utils/requestClientsRealDevPlugin'

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
      srcRoot: 'src',
      autoRoutes: true,
      injectRequestGlobals: true,
    },
  }
})
