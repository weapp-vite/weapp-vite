import { fileURLToPath } from 'node:url'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: { minify: false },
  resolve: {
    alias: { '@page-scripts': fileURLToPath(new URL('./src/pageScripts', import.meta.url)) },
  },
  weapp: {
    srcRoot: 'src',
    web: { enable: true },
    autoRoutes: { persistentCache: true },
    subPackages: { 'subpackages/account': {} },
  },
})
