import process from 'node:process'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig(() => ({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    ...(process.env.WEVU_BENCH_PRESET === 'performance'
      ? { wevu: { preset: 'performance' as const } }
      : {}),
  },
}))
