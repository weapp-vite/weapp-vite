import process from 'node:process'
import { defineConfig } from 'weapp-vite'

export default defineConfig(() => ({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
      runtime: process.env.WEAPP_VITE_JSX_HMR_RUNTIME === 'classic' ? 'classic' : 'auto',
    },
    srcRoot: 'src',
  },
  esbuild: {
    jsx: 'preserve',
  },
}))
