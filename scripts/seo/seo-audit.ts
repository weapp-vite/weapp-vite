import process from 'node:process'
import { collectMarkdownPaths, isPartialDocument } from './frontmatter'
import { assertAuditStrict, buildAuditResult, collectDocuments, pickQualityIssueCounts } from './report'

function hasFlag(flag: string) {
  return process.argv.includes(flag)
}

async function main() {
  const strict = hasFlag('--strict')
  const enrichFallback = !hasFlag('--no-enrich-fallback')

  const paths = await collectMarkdownPaths()
  const targetPaths = paths.filter(relativePath => !isPartialDocument(relativePath))
  const documents = await collectDocuments(targetPaths)

  const result = await buildAuditResult({
    documents,
    includeEnrichedFallback: enrichFallback,
  })

  const qualityIssueCounts = pickQualityIssueCounts(result.quality)

  const output = {
    ...result,
    qualityIssueCounts,
  }

  console.log(JSON.stringify(output, null, 2))

  if (strict) {
    assertAuditStrict(result)
  }
}

main().catch((error) => {
  console.error('[seo-audit] 执行失败')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
