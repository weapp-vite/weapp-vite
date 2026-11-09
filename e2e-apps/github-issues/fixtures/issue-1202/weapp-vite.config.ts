import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    npm: { enable: false },
    hmr: { runtime: 'classic' },
    subPackages: { regular: {}, isolated: { independent: true } },
    worker: { entry: ['index'] },
  },
})
