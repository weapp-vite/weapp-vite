import process from 'node:process'
import { runDeepWikiCommand } from './deepwiki/command.mjs'

try {
  process.exitCode = await runDeepWikiCommand({
    args: process.argv.slice(2),
    mainSha: process.env.MAIN_SHA,
    summaryPath: process.env.GITHUB_STEP_SUMMARY,
  })
}
catch {
  console.error('::error::Unable to run the selected DeepWiki operation')
  process.exitCode = 1
}
