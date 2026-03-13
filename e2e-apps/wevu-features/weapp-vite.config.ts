import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    subPackages: {
      'packages/router-demo': {},
      'packages/router-demo-independent': {},
    },
  },
})
