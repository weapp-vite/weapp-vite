import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const appPreludeMode = process.env.APP_PRELUDE_MODE === 'entry' || process.env.APP_PRELUDE_MODE === 'require'
  ? process.env.APP_PRELUDE_MODE
  : 'inline'
const requestGlobalsPreludeEnabled = process.env.APP_PRELUDE_REQUEST_GLOBALS === '1'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    appPrelude: {
      mode: appPreludeMode,
    },
    injectRequestGlobals: requestGlobalsPreludeEnabled
      ? {
          enabled: true,
          prelude: true,
          targets: ['fetch', 'Headers', 'Request', 'Response'],
        }
      : undefined,
    chunks: {
      sharedStrategy: 'common',
    },
  },
})
