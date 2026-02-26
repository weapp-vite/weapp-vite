import process from 'node:process'
import { collectMarkdownPaths, isPartialDocument, readMarkdownDocument, writeMarkdownFrontmatter } from './frontmatter'
import { inferKeywords, inferTitle, normalizeKeywords } from './metadata'

function hasFlag(flag: string) {
  return process.argv.includes(flag)
}

async function main() {
  const strict = hasFlag('--strict')
  const write = !hasFlag('--check')

  const paths = await collectMarkdownPaths()
  const targets = paths.filter(relativePath => !isPartialDocument(relativePath))

  let changedCount = 0
  let nonNormalizedCount = 0
  const changedFiles: string[] = []

  for (const relativePath of targets) {
    const document = await readMarkdownDocument(relativePath)
    const title = inferTitle(document)

    const current = document.frontmatter.keywords

    const inferred = inferKeywords(document, title)
    const normalized = normalizeKeywords(current, inferred)

    const nextFrontmatter = {
      ...document.frontmatter,
      keywords: normalized,
    }

    const normalizedCurrent = normalizeKeywords(current)
    if (normalizedCurrent.join('|') !== normalized.join('|')) {
      nonNormalizedCount += 1
    }

    const needsUpdate = JSON.stringify(document.frontmatter.keywords) !== JSON.stringify(normalized)
    const changed = write
      ? await writeMarkdownFrontmatter(document, nextFrontmatter)
      : needsUpdate
    if (changed) {
      changedCount += 1
      changedFiles.push(relativePath)
    }
  }

  console.log(JSON.stringify({
    script: 'seo-normalize-keywords',
    total: targets.length,
    changed: changedCount,
    nonNormalized: nonNormalizedCount,
    write,
    files: changedFiles,
  }, null, 2))

  if (strict && nonNormalizedCount > 0) {
    throw new Error(`检测到 ${nonNormalizedCount} 个文件关键词未标准化。`)
  }
}

main().catch((error) => {
  console.error('[seo-normalize-keywords] 执行失败')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
