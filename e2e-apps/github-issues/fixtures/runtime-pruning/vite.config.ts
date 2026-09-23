import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    web: {
      enable: true,
      outDir: 'dist/web',
    },
  },
})
