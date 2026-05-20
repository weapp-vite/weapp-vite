import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    // weapp-vite options
    srcRoot: 'miniprogram',
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
