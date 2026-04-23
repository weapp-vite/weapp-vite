import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    generate: {
      dirs: {
        component: 'src/components',
        page: 'src/pages',
      },
      filenames: {
        app: 'app',
        component: 'index',
        page: 'index',
      },
    },
  },
})
