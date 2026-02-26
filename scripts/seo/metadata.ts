import type { MarkdownDocument, QualityIssue, QualitySummary } from './types'
import path from 'node:path'
import { defaultKeywords } from './constants'

const keywordAliasMap = new Map<string, string>([
  ['weapp vite', 'weapp-vite'],
  ['weapp-vite', 'weapp-vite'],
  ['wevu runtime', 'wevu'],
  ['wevu', 'wevu'],
  ['wechat miniprogram', '微信小程序'],
  ['wechat mini program', '微信小程序'],
  ['miniprogram', '微信小程序'],
  ['mini program', '微信小程序'],
  ['vue sfc', 'Vue SFC'],
  ['vue3', 'Vue 3'],
  ['vite press', 'VitePress'],
  ['vitepress', 'VitePress'],
])

const keywordStopwords = new Set([
  '',
  '文档',
  '教程',
  '指南',
  '说明',
  '介绍',
  '页面',
  '文章',
  'index',
  'home',
  'readme',
  'the',
  'and',
  'or',
])

const qualityTemplatePatterns: RegExp[] = [
  /^本文(主要)?(介绍|讲解|说明)/,
  /^本页(主要)?(介绍|说明)/,
  /^欢迎阅读/,
  /^该页面(主要)?(介绍|说明)/,
  /更多内容请(查看|参考)/,
]

function trimKeyword(raw: string) {
  return raw
    .trim()
    .replace(/^[\s'"“”‘’`]+|[\s'"“”‘’`]+$/g, '')
    .replace(/[，,、;；]+$/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeKeywordCase(keyword: string) {
  if (/^[a-z0-9-]+$/i.test(keyword)) {
    return keyword.toLowerCase()
  }
  return keyword
}

function toDisplayKeyword(rawKeyword: string) {
  const keyword = trimKeyword(rawKeyword)
  if (!keyword) {
    return ''
  }

  const mapped = keywordAliasMap.get(keyword.toLowerCase())
  if (mapped) {
    return mapped
  }

  return normalizeKeywordCase(keyword)
}

function splitKeywords(input: unknown) {
  if (Array.isArray(input)) {
    return input.map(item => String(item))
  }
  if (typeof input === 'string') {
    return input.split(/[，,、;；/|]/g)
  }
  return []
}

function sanitizeKeywordToken(token: string) {
  const clean = trimKeyword(token)
    .replace(/[*`]/g, '')
    .replace(/\{#[^}]+\}/g, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) {
    return ''
  }

  const lower = clean.toLowerCase()
  if (keywordStopwords.has(lower)) {
    return ''
  }

  if (clean.length > 24) {
    return ''
  }

  return toDisplayKeyword(clean)
}

function uniqueKeywords(tokens: string[]) {
  const result: string[] = []
  const seen = new Set<string>()

  for (const token of tokens) {
    const normalized = sanitizeKeywordToken(token)
    if (!normalized) {
      continue
    }

    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(normalized)
  }

  return result
}

function inferKeywordCandidates(document: MarkdownDocument) {
  const joined = [document.relativePath, document.frontmatter.title, ...document.headings]
    .filter(Boolean)
    .map(value => String(value))
    .join(' | ')

  const candidates: string[] = []

  if (/weapp[- ]?vite/i.test(joined)) {
    candidates.push('weapp-vite')
  }
  if (/\bwevu\b/i.test(joined)) {
    candidates.push('wevu')
  }
  if (/vue\s*sfc|script setup|template/i.test(joined)) {
    candidates.push('Vue SFC')
  }
  if (/微信|小程序|miniprogram/i.test(joined)) {
    candidates.push('微信小程序')
  }
  if (/vitepress/i.test(joined)) {
    candidates.push('VitePress')
  }
  if (/配置|config/i.test(joined)) {
    candidates.push('配置')
  }
  if (/迁移|migration/i.test(joined)) {
    candidates.push('迁移指南')
  }
  if (/调试|troubleshoot|debug/i.test(joined)) {
    candidates.push('调试')
  }
  if (/性能|performance/i.test(joined)) {
    candidates.push('性能优化')
  }
  if (/分包|subpackage/i.test(joined)) {
    candidates.push('分包')
  }
  if (/运行时|runtime/i.test(joined)) {
    candidates.push('运行时')
  }
  if (/编译|compiler/i.test(joined)) {
    candidates.push('编译')
  }
  if (/api/i.test(joined)) {
    candidates.push('API')
  }

  const pathTokens = document.relativePath
    .replace(/\.mdx?$/i, '')
    .split(/[/-]/g)
    .map(token => token.trim())
    .filter(Boolean)

  for (const token of pathTokens) {
    if (/^[a-z0-9][a-z0-9-]{1,20}$/i.test(token)) {
      candidates.push(token)
    }
  }

  if (document.bucket === 'blog') {
    candidates.push('发布日志', '版本更新')
  }

  return candidates
}

function clampDescription(text: string, maxLength = 120) {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length <= maxLength) {
    return clean
  }
  return `${clean.slice(0, maxLength - 1)}…`
}

function normalizeTitle(text: string) {
  return text
    .replace(/\s*\{#[^}]+\}\s*/g, ' ')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toTitleFromFilename(relativePath: string) {
  const name = path.posix.basename(relativePath).replace(/\.mdx?$/i, '')
  if (name === 'index') {
    return '文档索引'
  }
  return name
    .split(/[-_]/g)
    .map(token => token.trim())
    .filter(Boolean)
    .join(' ')
}

function formatDate(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeKeywords(input: unknown, fallbackKeywords: string[] = []) {
  const merged = [...splitKeywords(input), ...fallbackKeywords]
  const normalized = uniqueKeywords(merged)

  if (normalized.length >= 3) {
    return normalized.slice(0, 8)
  }

  return uniqueKeywords([...normalized, ...defaultKeywords]).slice(0, 8)
}

export function inferTitle(document: MarkdownDocument) {
  const current = document.frontmatter.title
  if (typeof current === 'string' && current.trim()) {
    return normalizeTitle(current)
  }

  const firstHeading = document.headings[0]
  if (firstHeading) {
    return normalizeTitle(firstHeading)
  }

  return normalizeTitle(toTitleFromFilename(document.relativePath))
}

export function hasTemplatedDescription(description: string) {
  const clean = description.trim()
  return qualityTemplatePatterns.some(pattern => pattern.test(clean))
}

export function inferDescription(document: MarkdownDocument, title: string) {
  const current = document.frontmatter.description
  if (typeof current === 'string' && current.trim().length >= 24 && !hasTemplatedDescription(current)) {
    return clampDescription(current)
  }

  if (document.firstParagraph.length >= 30) {
    return clampDescription(document.firstParagraph)
  }

  const routeHint = document.relativePath
    .replace(/\.mdx?$/i, '')
    .split('/')
    .slice(0, 2)
    .join(' / ')

  return clampDescription(
    `${title}，聚焦 ${routeHint || 'weapp-vite'} 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。`,
  )
}

export function inferKeywords(document: MarkdownDocument, title: string) {
  const current = splitKeywords(document.frontmatter.keywords)
  const inferred = inferKeywordCandidates(document)
  const textTokens = title.split(/[\s,，、;；]+/g).filter(token => token.length <= 20)
  return normalizeKeywords([...current, ...inferred, ...textTokens])
}

export function inferDateForBlog(relativePath: string, modifiedTimeMs: number) {
  if (!relativePath.startsWith('blog/')) {
    return null
  }
  return formatDate(new Date(modifiedTimeMs))
}

function countDuplicates(tokens: string[]) {
  const seen = new Set<string>()
  let duplicateCount = 0
  for (const token of tokens) {
    const key = token.toLowerCase()
    if (seen.has(key)) {
      duplicateCount += 1
      continue
    }
    seen.add(key)
  }
  return duplicateCount
}

function hasKeywordNoise(_description: string, keywords: string[]) {
  return keywords.some(keyword => /[*`{}[\]|]/.test(keyword) || keyword.split(/\s+/g).length > 3)
}

export function checkDocumentQuality(document: MarkdownDocument): QualityIssue[] {
  const issues: QualityIssue[] = []
  const description = typeof document.frontmatter.description === 'string'
    ? document.frontmatter.description.trim()
    : ''

  const keywords = splitKeywords(document.frontmatter.keywords)
    .map(item => toDisplayKeyword(item))
    .filter(Boolean)

  if (!description) {
    issues.push({
      path: document.relativePath,
      type: 'missing-description',
      message: '缺少 description。',
    })
  }
  else {
    if (description.length < 24) {
      issues.push({
        path: document.relativePath,
        type: 'short-description',
        message: 'description 过短（少于 24 个字符）。',
        detail: description,
      })
    }

    if (hasTemplatedDescription(description)) {
      issues.push({
        path: document.relativePath,
        type: 'templated-description',
        message: 'description 疑似模板化。',
        detail: description,
      })
    }
  }

  if (keywords.length === 0) {
    issues.push({
      path: document.relativePath,
      type: 'missing-keywords',
      message: '缺少 keywords。',
    })
  }
  else {
    if (keywords.length < 3) {
      issues.push({
        path: document.relativePath,
        type: 'few-keywords',
        message: 'keywords 数量不足 3 个。',
        detail: keywords.join(', '),
      })
    }

    if (keywords.some(keyword => keyword.length > 24)) {
      issues.push({
        path: document.relativePath,
        type: 'keyword-too-long',
        message: '存在过长关键词（超过 24 个字符）。',
        detail: keywords.join(', '),
      })
    }

    if (countDuplicates(keywords) > 0) {
      issues.push({
        path: document.relativePath,
        type: 'duplicate-keywords',
        message: 'keywords 存在重复项。',
        detail: keywords.join(', '),
      })
    }

    const normalized = normalizeKeywords(keywords)
    if (normalized.join('|') !== keywords.join('|')) {
      issues.push({
        path: document.relativePath,
        type: 'non-normalized-keywords',
        message: 'keywords 未标准化（去噪/去重/格式不一致）。',
        detail: `当前: ${keywords.join(', ')} | 标准: ${normalized.join(', ')}`,
      })
    }

    if (hasKeywordNoise(description, keywords)) {
      issues.push({
        path: document.relativePath,
        type: 'description-keyword-noise',
        message: 'description 或 keywords 存在重复词噪声。',
        detail: `description: ${description} | keywords: ${keywords.join(', ')}`,
      })
    }
  }

  return issues
}

export function summarizeQuality(documents: MarkdownDocument[]): QualitySummary {
  const issues = documents.flatMap(document => checkDocumentQuality(document))
  return {
    checked: documents.length,
    issues,
  }
}
