import { defineConfig } from 'weapp-vite'
import { requestClientsRealDevPlugin } from '../../e2e/utils/requestClientsRealDevPlugin'

export default defineConfig(async env => ({
  plugins: env.command === 'serve'
    ? [
        await requestClientsRealDevPlugin({
          projectRoot: import.meta.dirname,
        }),
      ]
    : [],
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    injectRequestGlobals: true,
  },
}))
