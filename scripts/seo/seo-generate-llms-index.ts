import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { siteBaseUrl, websiteRoot } from './constants'
import { collectMarkdownPaths, isPartialDocument } from './frontmatter'
import { inferDescription, inferKeywords, inferTitle, normalizeKeywords } from './metadata'
import { collectDocuments } from './report'

function toCanonicalUrl(routePath: string) {
  if (routePath === '/') {
    return `${siteBaseUrl}/`
  }
  return `${siteBaseUrl}${routePath}`
}

function clampText(text: string, maxLength: number) {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length <= maxLength) {
    return clean
  }
  return `${clean.slice(0, maxLength - 1)}…`
}

function toUpdatedAt(frontmatterDate: unknown, modifiedAtMs: number) {
  if (typeof frontmatterDate === 'string' && frontmatterDate.trim()) {
    return frontmatterDate.trim()
  }

  const date = new Date(modifiedAtMs)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createStableId(routePath: string, source: string) {
  const sourceKey = `${routePath}|${source}`
  const hash = createHash('sha1').update(sourceKey).digest('hex').slice(0, 10)
  return `doc-${hash}`
}

function readOption(name: string, fallback: string) {
  const prefix = `--${name}=`
  const arg = process.argv.find(item => item.startsWith(prefix))
  if (!arg) {
    return fallback
  }
  return arg.slice(prefix.length)
}

async function main() {
  const outputFile = readOption('output', path.resolve(websiteRoot, 'public', 'llms-index.json'))
  const paths = await collectMarkdownPaths()
  const targets = paths.filter(relativePath => !isPartialDocument(relativePath))
  const documents = await collectDocuments(targets)

  const items = await Promise.all(documents.map(async (document) => {
    const title = inferTitle(document)
    const description = inferDescription(document, title)
    const keywords = normalizeKeywords(document.frontmatter.keywords, inferKeywords(document, title))
    const stat = await fs.stat(document.absolutePath)

    return {
      id: createStableId(document.routePath, document.relativePath),
      title,
      summary: clampText(description, 180),
      url: document.routePath,
      canonical: toCanonicalUrl(document.routePath),
      keywords,
      headings: document.headings.slice(0, 12),
      updatedAt: toUpdatedAt(document.frontmatter.date, stat.mtimeMs),
      source: document.relativePath,
    }
  }))

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    site: siteBaseUrl,
    count: items.length,
    items,
  }

  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  await fs.writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify({
    script: 'seo-generate-llms-index',
    outputFile,
    count: items.length,
  }, null, 2))
}

main().catch((error) => {
  console.error('[seo-generate-llms-index] 执行失败')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
