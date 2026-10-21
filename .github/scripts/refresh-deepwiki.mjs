import process from 'node:process'

import { chromium } from 'playwright'
import { resultExitCode, runDeepWiki } from './refresh-deepwiki/index.mjs'
import { createPageAdapter } from './refresh-deepwiki/page.mjs'
import { createReporter } from './refresh-deepwiki/report.mjs'

const report = createReporter({ rootDirectory: '.tmp/deepwiki-refresh', summaryPath: process.env.GITHUB_STEP_SUMMARY })

try {
  const result = await runDeepWiki({
    launch: () => chromium.launch({ headless: true }),
    createAdapter: createPageAdapter,
    report,
    mainSha: process.env.MAIN_SHA,
  })
  process.exitCode = resultExitCode(result)
}
catch (error) {
  process.exitCode = 1
  await report({
    status: 'failed',
    reason: error.message,
    error: { name: error.name, message: error.message, ...(error.cleanupError ? { cleanupError: error.cleanupError } : {}) },
    ...(error.refreshResult ? { refreshResult: error.refreshResult } : {}),
  })
}
