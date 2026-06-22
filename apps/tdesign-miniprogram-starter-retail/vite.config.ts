import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    copy: {
      include: ['common/assets/**'],
    },
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    mcp: {
      enabled: true,
      autoStart: true,
    },
    // weapp-vite options
  },
})
