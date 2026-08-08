import process from 'node:process'
import { defineConfig } from 'weapp-vite'
import { UviewPlusResolver } from 'weapp-vite/resolvers'

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "uview-plus/theme.scss" as *;\n',
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.UVIEW_PLUS_WEB_PORT ?? 5175),
    strictPort: true,
  },
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    vue: {
      template: {
        scopedSlotsCompiler: 'augmented',
      },
    },
    uniApp: {
      include: ['uview-plus'],
    },
    autoImportComponents: {
      resolvers: [UviewPlusResolver()],
      vueComponents: true,
      vueComponentsModule: 'wevu',
    },
  },
})
