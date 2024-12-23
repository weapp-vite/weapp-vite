import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    // weapp-vite options
    srcRoot: './miniprogram',
    // platform: 'alipay',
    enhance: {
      autoImportComponents: {
        globs: ['miniprogram/components/**/*']
      }
    },
    generate: {
      dirs: {
        component: './miniprogram/components'
      }
    }
  },
})
