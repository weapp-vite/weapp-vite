import process from 'node:process'
import { collectMarkdownPaths, isPartialDocument } from './frontmatter'
import { summarizeQuality } from './metadata'
import { collectDocuments, pickQualityIssueCounts } from './report'

function hasFlag(flag: string) {
  return process.argv.includes(flag)
}

async function main() {
  const strict = hasFlag('--strict')

  const paths = await collectMarkdownPaths()
  const targets = paths.filter(relativePath => !isPartialDocument(relativePath))
  const documents = await collectDocuments(targets)

  const quality = summarizeQuality(documents)
  const issueCounts = pickQualityIssueCounts(quality)

  console.log(JSON.stringify({
    script: 'seo-quality-check',
    checked: quality.checked,
    issueCount: quality.issues.length,
    issueCounts,
    issues: quality.issues,
  }, null, 2))

  if (strict && quality.issues.length > 0) {
    throw new Error(`质量门禁失败：发现 ${quality.issues.length} 项问题。`)
  }
}

main().catch((error) => {
  console.error('[seo-quality-check] 执行失败')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
