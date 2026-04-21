import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    pluginRoot: 'plugin',
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            '@/*': ['./*'],
          },
        },
      },
    },
    npm: {
      enable: true,
      pluginPackage: {
        dependencies: ['dayjs'],
      },
    },
  },
})
