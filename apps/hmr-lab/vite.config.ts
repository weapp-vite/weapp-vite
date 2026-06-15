import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const astEngine = process.env.HMR_LAB_AST_ENGINE === 'oxc' ? 'oxc' : 'babel'

export default defineConfig({
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
