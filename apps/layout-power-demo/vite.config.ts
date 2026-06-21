import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    routeRules: {
      '/pages/rules/index': {
        appLayout: {
          name: 'command',
          props: {
            mode: '路由配置',
            title: '配置外壳',
          },
        },
      },
    },
    hmr: {
      sharedChunks: 'auto',
    },
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            'tdesign-miniprogram/*': ['./node_modules/tdesign-miniprogram/miniprogram_dist/*'],
          },
        },
      },
    },
  },
})
