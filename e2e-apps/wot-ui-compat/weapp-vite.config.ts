import process from 'node:process'
import { defineConfig } from 'weapp-vite'
import { WotUiResolver } from 'weapp-vite/resolvers'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WOT_UI_WEB_PORT ?? 5174),
    strictPort: true,
  },
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    uniApp: {
      include: ['@wot-ui/ui'],
    },
    autoImportComponents: {
      resolvers: [WotUiResolver()],
      vueComponents: true,
      vueComponentsModule: 'wevu',
    },
  },
})
