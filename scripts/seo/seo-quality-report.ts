import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { websiteRoot } from './constants'
import { collectMarkdownPaths, isPartialDocument } from './frontmatter'
import { buildAuditResult, collectDocuments, pickQualityIssueCounts } from './report'

function readOption(name: string, fallback: string) {
  const prefix = `--${name}=`
  const item = process.argv.find(arg => arg.startsWith(prefix))
  if (!item) {
    return fallback
  }
  return item.slice(prefix.length)
}

async function main() {
  const outputFile = readOption('output', path.resolve(websiteRoot, 'public', 'seo-quality-report.json'))

  const paths = await collectMarkdownPaths()
  const targets = paths.filter(relativePath => !isPartialDocument(relativePath))
  const documents = await collectDocuments(targets)

  const result = await buildAuditResult({
    documents,
    includeEnrichedFallback: false,
  })

  const output = {
    ...result,
    qualityIssueCounts: pickQualityIssueCounts(result.quality),
  }

  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  await fs.writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify({
    script: 'seo-quality-report',
    outputFile,
    issueCount: result.quality.issues.length,
    checked: result.quality.checked,
  }, null, 2))
}

main().catch((error) => {
  console.error('[seo-quality-report] 执行失败')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
