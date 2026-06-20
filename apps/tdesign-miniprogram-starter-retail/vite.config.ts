import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
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
