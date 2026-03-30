import { TDesignResolver, VantResolver } from 'weapp-vite/auto-import-components/resolvers'
import { defineConfig } from 'weapp-vite'

export default defineConfig(() => ({
  weapp: {
    srcRoot: 'src', // 源代码目录
    routeRules: {
      '/layouts/route-rules-demo': {
        appLayout: {
          name: 'admin',
          props: {
            sidebar: true,
            title: 'Route Rules',
          },
        },
      },
    },
    hmr: {
      sharedChunks: 'auto',
    },
    autoImportComponents: {
      resolvers: [
        VantResolver(),
        TDesignResolver(),
      ],
      output: true,
      typedComponents: true,
      vueComponents: true,
    },
  },
  // weapp-vite 内置的 Vue 支持会自动处理 .vue 文件，不需要额外插件
}))
