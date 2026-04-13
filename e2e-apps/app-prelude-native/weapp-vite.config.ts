import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const appPreludeMode = process.env.APP_PRELUDE_MODE === 'inline'
  || process.env.APP_PRELUDE_MODE === 'entry'
  || process.env.APP_PRELUDE_MODE === 'require'
  ? process.env.APP_PRELUDE_MODE
  : 'require'
const requestGlobalsPreludeEnabled = process.env.APP_PRELUDE_REQUEST_GLOBALS === '1'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    appPrelude: {
      mode: appPreludeMode,
      webRuntime: requestGlobalsPreludeEnabled
        ? {
            enabled: true,
            targets: ['fetch', 'Headers', 'Request', 'Response'],
          }
        : undefined,
    },
    chunks: {
      sharedStrategy: 'common',
    },
  },
})
