import type { DocumentBucket, FrontmatterKind, MarkdownDocument } from './types'
import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import YAML from 'yaml'
import { frontmatterKeyHints, markdownIgnoreGlobs, websiteRoot } from './constants'

const standardFrontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const yamlKeyPattern = /^[A-Z_][\w-]*\s*:/i

function toPosixPath(filePath: string) {
  return filePath.replace(/\\/g, '/')
}

function stripCodeFences(markdown: string) {
  return markdown.replace(/```[\s\S]*?```/g, '')
}

function stripInlineMarkdown(markdown: string) {
  return markdown
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function isHeadingLine(line: string) {
  return /^#{1,6}[ \t]+/.test(line)
}

function isMarkdownNoise(line: string) {
  return (
    /^>\s*/.test(line)
    || /^[-*+]\s+/.test(line)
    || /^\d+\.\s+/.test(line)
    || /^\|/.test(line)
    || /^\s*```/.test(line)
    || /^\s*import\s+/.test(line)
    || /^\s*export\s+/.test(line)
    || /^\s*<[^>]+>/.test(line)
  )
}

function extractHeadings(body: string) {
  const headings: string[] = []
  const cleanBody = stripCodeFences(body)
  for (const rawLine of cleanBody.split(/\r?\n/)) {
    if (!rawLine.startsWith('#')) {
      continue
    }
    const prefix = rawLine.match(/^(#{1,6})[ \t]+/)
    if (!prefix) {
      continue
    }
    const heading = normalizeWhitespace(stripInlineMarkdown(rawLine.slice(prefix[0].length)))
    if (heading) {
      headings.push(heading)
    }
  }
  return headings
}

function extractFirstParagraph(body: string) {
  const lines = stripCodeFences(body).split(/\r?\n/)
  const collected: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      if (collected.length > 0) {
        break
      }
      continue
    }

    if (isHeadingLine(line) || isMarkdownNoise(line)) {
      if (collected.length > 0) {
        break
      }
      continue
    }

    collected.push(line)
    if (normalizeWhitespace(collected.join(' ')).length >= 120) {
      break
    }
  }

  return normalizeWhitespace(stripInlineMarkdown(collected.join(' ')))
}

function parseYamlRecord(source: string) {
  const parsed = YAML.parse(source)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }
  return parsed as Record<string, unknown>
}

function parseStandardFrontmatter(raw: string) {
  const match = raw.match(standardFrontmatterPattern)
  if (!match) {
    return null
  }

  let frontmatter: Record<string, unknown> = {}
  try {
    frontmatter = parseYamlRecord(match[1] ?? '')
  }
  catch {
    frontmatter = {}
  }

  const body = raw.slice(match[0].length).replace(/^\r?\n+/, '')

  return {
    frontmatter,
    body,
    kind: 'standard' as const,
  }
}

function parseBareFrontmatter(raw: string) {
  const lines = raw.split(/\r?\n/)
  if (!yamlKeyPattern.test(lines[0] ?? '')) {
    return null
  }

  const collected: string[] = []
  let sawYamlKey = false
  let cursor = 0

  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? ''

    if (yamlKeyPattern.test(line)) {
      sawYamlKey = true
      collected.push(line)
      continue
    }

    if (!sawYamlKey) {
      break
    }

    if (/^\s+/.test(line) || /^-\s+/.test(line) || line.trim() === '') {
      collected.push(line)
      continue
    }

    break
  }

  if (!sawYamlKey) {
    return null
  }

  const yamlSource = collected.join('\n').trim()
  if (!yamlSource) {
    return null
  }

  let frontmatter: Record<string, unknown> = {}
  try {
    frontmatter = parseYamlRecord(yamlSource)
  }
  catch {
    return null
  }

  const keys = Object.keys(frontmatter)
  if (keys.length === 0 || !keys.some(key => frontmatterKeyHints.has(key))) {
    return null
  }

  const body = lines.slice(cursor).join('\n').replace(/^\n+/, '')

  return {
    frontmatter,
    body,
    kind: 'bare' as const,
  }
}

function parseFrontmatter(raw: string) {
  const standard = parseStandardFrontmatter(raw)
  if (standard) {
    return standard
  }

  const bare = parseBareFrontmatter(raw)
  if (bare) {
    return bare
  }

  return {
    frontmatter: {},
    body: raw,
    kind: 'none' as const,
  }
}

function classifyBucket(relativePath: string): DocumentBucket {
  if (relativePath.startsWith('blog/')) {
    return 'blog'
  }
  if (!relativePath.includes('/')) {
    return 'page'
  }
  return 'docs'
}

function toRoutePath(relativePath: string) {
  const normalized = toPosixPath(relativePath).replace(/\.mdx?$/i, '')
  if (normalized === 'index') {
    return '/'
  }
  if (normalized.endsWith('/index')) {
    const base = normalized.slice(0, -('/index'.length))
    return `/${base}/`
  }
  return `/${normalized}`
}

function cleanFrontmatter(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue
    }

    if (typeof value === 'string') {
      const next = value.trim()
      if (!next) {
        continue
      }
      output[key] = next
      continue
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue
      }
      output[key] = value
      continue
    }

    output[key] = value
  }

  return output
}

function formatDocument(frontmatter: Record<string, unknown>, body: string, kind: FrontmatterKind) {
  const clean = cleanFrontmatter(frontmatter)
  const yamlSource = YAML.stringify(clean).trimEnd()
  const normalizedBody = body.replace(/^\s*\n/, '').trimEnd()

  if (kind === 'bare') {
    if (!yamlSource) {
      return `${normalizedBody}\n`
    }
    return `${yamlSource}\n\n${normalizedBody}\n`
  }

  if (!yamlSource) {
    return `${normalizedBody}\n`
  }

  return `---\n${yamlSource}\n---\n\n${normalizedBody}\n`
}

export async function collectMarkdownPaths() {
  const files = await fg(['**/*.md', '**/*.mdx'], {
    cwd: websiteRoot,
    ignore: markdownIgnoreGlobs,
    onlyFiles: true,
    dot: false,
  })

  return files.map(toPosixPath).sort((a, b) => a.localeCompare(b))
}

export function isPartialDocument(relativePath: string) {
  return path.posix.basename(relativePath).startsWith('_')
}

export async function readMarkdownDocument(relativePath: string): Promise<MarkdownDocument> {
  const absolutePath = path.resolve(websiteRoot, relativePath)
  const raw = await fs.readFile(absolutePath, 'utf8')
  const parsed = parseFrontmatter(raw)

  return {
    absolutePath,
    relativePath,
    routePath: toRoutePath(relativePath),
    bucket: classifyBucket(relativePath),
    raw,
    body: parsed.body,
    frontmatter: parsed.frontmatter,
    frontmatterKind: parsed.kind,
    headings: extractHeadings(parsed.body),
    firstParagraph: extractFirstParagraph(parsed.body),
  }
}

export async function writeMarkdownFrontmatter(
  document: MarkdownDocument,
  frontmatter: Record<string, unknown>,
  options?: { preferStandard?: boolean },
) {
  const nextKind: FrontmatterKind
    = options?.preferStandard || document.frontmatterKind === 'none'
      ? 'standard'
      : document.frontmatterKind

  const nextContent = formatDocument(frontmatter, document.body, nextKind)
  if (nextContent === document.raw) {
    return false
  }

  await fs.writeFile(document.absolutePath, nextContent, 'utf8')
  return true
}
