import process from 'node:process'
import { defineConfig } from 'weapp-vite'
import { requestClientsRealDevPlugin } from '../../e2e/utils/requestClientsRealDevPlugin'

const shouldEnableRequestClientsRealDevPlugin = process.argv.includes('dev')

export default defineConfig(async () => ({
  plugins: shouldEnableRequestClientsRealDevPlugin
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
