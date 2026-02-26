import fs from 'node:fs/promises'
import process from 'node:process'
import { collectMarkdownPaths, isPartialDocument, readMarkdownDocument, writeMarkdownFrontmatter } from './frontmatter'
import { inferDateForBlog, inferDescription, inferKeywords, inferTitle } from './metadata'

function hasFlag(flag: string) {
  return process.argv.includes(flag)
}

async function main() {
  const strict = hasFlag('--strict')
  const write = !hasFlag('--check')

  const paths = await collectMarkdownPaths()
  const targets = paths.filter(relativePath => !isPartialDocument(relativePath))

  let changedCount = 0
  let skippedCount = 0
  const changedFiles: string[] = []

  for (const relativePath of targets) {
    const document = await readMarkdownDocument(relativePath)
    const nextFrontmatter = { ...document.frontmatter }

    const title = inferTitle(document)
    const description = inferDescription(document, title)
    const keywords = inferKeywords(document, title)

    nextFrontmatter.title = title
    nextFrontmatter.description = description
    nextFrontmatter.keywords = keywords

    if (document.bucket === 'blog' && !nextFrontmatter.date) {
      const stat = await fs.stat(document.absolutePath)
      const date = inferDateForBlog(relativePath, stat.mtimeMs)
      if (date) {
        nextFrontmatter.date = date
      }
    }

    const needsUpdate = JSON.stringify(document.frontmatter) !== JSON.stringify(nextFrontmatter)

    const changed = write
      ? await writeMarkdownFrontmatter(document, nextFrontmatter, {
          preferStandard: document.frontmatterKind === 'none',
        })
      : needsUpdate

    if (changed) {
      changedCount += 1
      changedFiles.push(relativePath)
      continue
    }

    skippedCount += 1
  }

  console.log(JSON.stringify({
    script: 'seo-enrich-frontmatter',
    total: targets.length,
    changed: changedCount,
    skipped: skippedCount,
    write,
    files: changedFiles,
  }, null, 2))

  if (strict && changedCount > 0) {
    throw new Error(`存在 ${changedCount} 个文件需要补齐 frontmatter，请先执行 seo-enrich-frontmatter。`)
  }
}

main().catch((error) => {
  console.error('[seo-enrich-frontmatter] 执行失败')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
