import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    generate: {
      dirs: {
        component: 'src/components',
        page: 'src/pages',
      },
      filenames: {
        style: 'index.wxss',
        template: 'index.wxml',
      },
    },
  },
})
