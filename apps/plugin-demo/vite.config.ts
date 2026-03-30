import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    // weapp-vite options
    srcRoot: 'miniprogram',
    pluginRoot: 'plugin',
    npm: {
      enable: true,
      pluginPackage: {
        dependencies: ['dayjs'],
      },
    },
  },
})
