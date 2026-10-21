import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { formatSummary, monitorDeepWiki } from './index.mjs'

export async function run({ mainSha, summaryPath }) {
  const result = await monitorDeepWiki({ mainSha })
  const summary = formatSummary(result)
  console.log(summary)
  let exitCode = ['stale', 'unavailable'].includes(result.status) ? 1 : 0

  try {
    if (summaryPath) {
      await appendFile(summaryPath, summary)
    }
    const directory = '.tmp/deepwiki-monitor'
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, 'status.json'), `${JSON.stringify(result, null, 2)}\n`)
  }
  catch {
    console.error('::error::Unable to save the DeepWiki monitor report')
    exitCode = 1
  }

  if (['stale', 'unavailable'].includes(result.status)) {
    console.error(`::error::DeepWiki index monitor: ${result.status}`)
  }
  return exitCode
}
