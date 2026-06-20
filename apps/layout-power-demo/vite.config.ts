import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    routeRules: {
      '/pages/rules/index': {
        appLayout: {
          name: 'command',
          props: {
            mode: 'routeRules',
            title: 'Route Rules Shell',
          },
        },
      },
    },
    hmr: {
      sharedChunks: 'auto',
    },
  },
})
