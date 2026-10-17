import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { formatSummary, monitorDeepWiki } from './deepwiki/index.mjs'

const result = await monitorDeepWiki({ mainSha: process.env.MAIN_SHA })
const summary = formatSummary(result)
console.log(summary)

try {
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  }
  const directory = '.tmp/deepwiki-monitor'
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'status.json'), `${JSON.stringify(result, null, 2)}\n`)
}
catch {
  console.error('::error::Unable to save the DeepWiki monitor report')
  process.exitCode = 1
}

if (result.status === 'stale' || result.status === 'unavailable') {
  console.error(`::error::DeepWiki index monitor: ${result.status}`)
  process.exitCode = 1
}
