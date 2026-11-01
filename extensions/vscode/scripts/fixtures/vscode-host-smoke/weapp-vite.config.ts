import { defineConfig } from 'weapp-vite'

const config = defineConfig({
  weapp: {
    language: {
      overrides: [{ files: ['src/language-tools/mixed.sjs.ts', 'src/language-tools/mixedConsumer.sjs.ts'], platform: 'tt' }],
    },
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

export default {
  ...config,
  fmt: {
    tabWidth: 2,
    overrides: [{ files: ['src/language-tools/style.wxss'], options: { tabWidth: 4 } }],
  },
}
