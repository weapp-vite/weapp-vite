import { chromium } from 'playwright'
import { resultExitCode, runDeepWiki } from './index.mjs'
import { createPageAdapter } from './page.mjs'
import { createReporter } from './report.mjs'

export async function run({ mainSha, summaryPath }) {
  const report = createReporter({ rootDirectory: '.tmp/deepwiki-refresh', summaryPath })
  try {
    const result = await runDeepWiki({
      launch: () => chromium.launch({ headless: true }),
      createAdapter: createPageAdapter,
      report,
      mainSha,
    })
    return resultExitCode(result)
  }
  catch (error) {
    await report({
      status: 'failed',
      reason: error.message,
      error: { name: error.name, message: error.message, ...(error.cleanupError ? { cleanupError: error.cleanupError } : {}) },
      ...(error.refreshResult ? { refreshResult: error.refreshResult } : {}),
    })
    return 1
  }
}
