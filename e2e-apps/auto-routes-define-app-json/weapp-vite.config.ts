import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
      runtime: 'classic',
    },
    srcRoot: 'src',
    autoRoutes: true,
    subPackages: {
      'subpackages/lab': {},
      'subpackages/marketing': {},
    },
  },
})
