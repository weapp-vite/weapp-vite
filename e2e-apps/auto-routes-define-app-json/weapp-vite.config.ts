import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    subPackages: {
      'subpackages/lab': {},
      'subpackages/marketing': {},
    },
  },
})
