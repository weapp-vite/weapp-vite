import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const astEngine = process.env.HMR_LAB_AST_ENGINE === 'oxc' ? 'oxc' : 'babel'
const parsedBuildDelay = process.env.HMR_LAB_BUILD_DELAY
  ? Number.parseInt(process.env.HMR_LAB_BUILD_DELAY, 10)
  : Number.NaN
const buildDelay = Number.isFinite(parsedBuildDelay) && parsedBuildDelay >= 0
  ? parsedBuildDelay
  : undefined

export default defineConfig({
  build: {
    watch: buildDelay === undefined
      ? undefined
      : {
          buildDelay,
        },
  },
  weapp: {
    srcRoot: 'src',
    ast: {
      engine: astEngine,
    },
    hmr: {
      sharedChunks: 'auto',
      logLevel: 'verbose',
      profileJson: true,
    },
  },
})
