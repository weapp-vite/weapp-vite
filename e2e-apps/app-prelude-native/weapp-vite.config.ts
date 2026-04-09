import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const appPreludeMode = process.env.APP_PRELUDE_MODE === 'entry' || process.env.APP_PRELUDE_MODE === 'require'
  ? process.env.APP_PRELUDE_MODE
  : 'inline'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    appPrelude: {
      mode: appPreludeMode,
    },
    chunks: {
      sharedStrategy: 'common',
    },
  },
})
