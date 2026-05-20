import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    autoRoutes: true,
    subPackages: {
      'packages/router-demo': {},
      'packages/router-demo-independent': {},
    },
  },
})
