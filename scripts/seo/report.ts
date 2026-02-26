import type { CoverageSummary, MarkdownDocument, QualitySummary } from './types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { siteBaseUrl, websiteRoot } from './constants'
import { readMarkdownDocument } from './frontmatter'
import { inferDescription, inferKeywords, inferTitle, summarizeQuality } from './metadata'

interface SiteCapability {
  enabled: boolean
  detail: string
}

interface CoverageMatrix {
  all: CoverageSummary
  docs: CoverageSummary
  blog: CoverageSummary
  page: CoverageSummary
}

interface CoveragePercentMatrix {
  all: Record<string, number>
  docs: Record<string, number>
  blog: Record<string, number>
  page: Record<string, number>
}

interface BuildInput {
  documents: MarkdownDocument[]
  includeEnrichedFallback?: boolean
}

interface AuditResult {
  generatedAt: string
  site: string
  totals: {
    files: number
    docs: number
    blog: number
    page: number
    withFrontmatter: number
    missingFrontmatter: number
  }
  coverage: CoverageMatrix
  coveragePercent: CoveragePercentMatrix
  siteCapabilities: Record<string, SiteCapability>
  llmAssets: {
    llmsEntry: boolean
    llmsFullDist: boolean
    llmsTxtDist: boolean
    llmsIndexPublic: boolean
    seoQualityReportPublic: boolean
  }
  quality: QualitySummary
}

function createCoverageSummary(): CoverageSummary {
  return {
    total: 0,
    title: 0,
    description: 0,
    keywords: 0,
    date: 0,
  }
}

function hasStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasKeywordsValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.some(item => String(item).trim().length > 0)
  }
  if (typeof value === 'string') {
    return value.split(/[，,、;；/|]/g).some(item => item.trim().length > 0)
  }
  return false
}

function percent(value: number, total: number) {
  if (total === 0) {
    return 0
  }
  return Number(((value / total) * 100).toFixed(1))
}

function toCoveragePercent(summary: CoverageSummary) {
  return {
    title: percent(summary.title, summary.total),
    description: percent(summary.description, summary.total),
    keywords: percent(summary.keywords, summary.total),
    date: percent(summary.date, summary.total),
  }
}

function buildCoverage(documents: MarkdownDocument[]): CoverageMatrix {
  const coverage: CoverageMatrix = {
    all: createCoverageSummary(),
    docs: createCoverageSummary(),
    blog: createCoverageSummary(),
    page: createCoverageSummary(),
  }

  for (const document of documents) {
    const targets = [coverage.all, coverage[document.bucket]]

    for (const target of targets) {
      target.total += 1
      if (hasStringValue(document.frontmatter.title)) {
        target.title += 1
      }
      if (hasStringValue(document.frontmatter.description)) {
        target.description += 1
      }
      if (hasKeywordsValue(document.frontmatter.keywords)) {
        target.keywords += 1
      }
      if (hasStringValue(document.frontmatter.date)) {
        target.date += 1
      }
    }
  }

  return coverage
}

function toCoveragePercentMatrix(coverage: CoverageMatrix): CoveragePercentMatrix {
  return {
    all: toCoveragePercent(coverage.all),
    docs: toCoveragePercent(coverage.docs),
    blog: toCoveragePercent(coverage.blog),
    page: toCoveragePercent(coverage.page),
  }
}

function boolCapability(enabled: boolean, detail: string): SiteCapability {
  return { enabled, detail }
}

async function inspectSiteCapabilities() {
  const configPath = path.resolve(websiteRoot, '.vitepress', 'config.ts')
  const seoPath = path.resolve(websiteRoot, '.vitepress', 'seo.ts')
  const configSource = await fs.readFile(configPath, 'utf8')
  const seoSource = await fs.readFile(seoPath, 'utf8').catch(() => '')
  const combinedSource = `${configSource}\n${seoSource}`

  const hasSitemap = /\bsitemap\s*:\s*\{/.test(configSource)
  const hasCanonical = /canonical/.test(combinedSource)
  const hasOg = /og:/.test(combinedSource)
  const hasTwitter = /twitter:/.test(combinedSource)
  const hasJsonLd = /ld\+json|json-ld|TechArticle|BlogPosting|BreadcrumbList/.test(combinedSource)
  const hasHreflang = /hreflang/.test(combinedSource)
  const hasNoindex = /noindex|robots/.test(combinedSource)

  const robotsPath = path.resolve(websiteRoot, 'public', 'robots.txt')
  const robotsExists = await fs.access(robotsPath).then(() => true).catch(() => false)

  return {
    sitemap: boolCapability(hasSitemap, hasSitemap ? 'vitepress sitemap 已配置。' : '未检测到 sitemap 配置。'),
    robots: boolCapability(robotsExists, robotsExists ? 'public/robots.txt 已存在。' : '未发现 public/robots.txt。'),
    canonical: boolCapability(hasCanonical, hasCanonical ? '检测到 canonical 策略。' : '未检测到 canonical 策略。'),
    og: boolCapability(hasOg, hasOg ? '检测到 Open Graph 元信息。' : '未检测到 Open Graph 元信息。'),
    twitter: boolCapability(hasTwitter, hasTwitter ? '检测到 Twitter Card 元信息。' : '未检测到 Twitter Card 元信息。'),
    jsonLd: boolCapability(hasJsonLd, hasJsonLd ? '检测到 JSON-LD 结构化数据策略。' : '未检测到 JSON-LD 结构化数据策略。'),
    hreflang: boolCapability(hasHreflang, hasHreflang ? '检测到 hreflang 策略。' : '未检测到 hreflang 策略。'),
    noindex: boolCapability(hasNoindex, hasNoindex ? '检测到 noindex/robots 策略。' : '未检测到 noindex/robots 策略。'),
  }
}

async function inspectLlmAssets() {
  const checks = {
    llmsEntry: path.resolve(websiteRoot, 'llms.md'),
    llmsFullDist: path.resolve(websiteRoot, 'dist', 'llms-full.txt'),
    llmsTxtDist: path.resolve(websiteRoot, 'dist', 'llms.txt'),
    llmsIndexPublic: path.resolve(websiteRoot, 'public', 'llms-index.json'),
    seoQualityReportPublic: path.resolve(websiteRoot, 'public', 'seo-quality-report.json'),
  }

  const result: Record<string, boolean> = {}
  for (const [key, filePath] of Object.entries(checks)) {
    result[key] = await fs.access(filePath).then(() => true).catch(() => false)
  }

  return result as AuditResult['llmAssets']
}

function withEnrichedFallback(documents: MarkdownDocument[]) {
  return documents.map((document) => {
    const frontmatter = { ...document.frontmatter }

    const title = hasStringValue(frontmatter.title)
      ? String(frontmatter.title)
      : inferTitle(document)

    const description = hasStringValue(frontmatter.description)
      ? String(frontmatter.description)
      : inferDescription(document, title)

    const keywords = hasKeywordsValue(frontmatter.keywords)
      ? frontmatter.keywords
      : inferKeywords(document, title)

    frontmatter.title = title
    frontmatter.description = description
    frontmatter.keywords = keywords

    return {
      ...document,
      frontmatter,
    }
  })
}

export async function buildAuditResult(input: BuildInput): Promise<AuditResult> {
  const documents = input.includeEnrichedFallback ? withEnrichedFallback(input.documents) : input.documents
  const coverage = buildCoverage(documents)
  const coveragePercent = toCoveragePercentMatrix(coverage)
  const siteCapabilities = await inspectSiteCapabilities()
  const llmAssets = await inspectLlmAssets()
  const quality = summarizeQuality(documents)

  const withFrontmatter = documents.filter(document => Object.keys(document.frontmatter).length > 0).length

  return {
    generatedAt: new Date().toISOString(),
    site: siteBaseUrl,
    totals: {
      files: documents.length,
      docs: documents.filter(document => document.bucket === 'docs').length,
      blog: documents.filter(document => document.bucket === 'blog').length,
      page: documents.filter(document => document.bucket === 'page').length,
      withFrontmatter,
      missingFrontmatter: documents.length - withFrontmatter,
    },
    coverage,
    coveragePercent,
    siteCapabilities,
    llmAssets,
    quality,
  }
}

export function assertAuditStrict(result: AuditResult) {
  const failures: string[] = []

  const { coveragePercent, siteCapabilities, llmAssets } = result

  if (coveragePercent.all.title < 95) {
    failures.push(`title 覆盖率过低：${coveragePercent.all.title}% < 95%`)
  }
  if (coveragePercent.all.description < 95) {
    failures.push(`description 覆盖率过低：${coveragePercent.all.description}% < 95%`)
  }
  if (coveragePercent.all.keywords < 95) {
    failures.push(`keywords 覆盖率过低：${coveragePercent.all.keywords}% < 95%`)
  }
  if (coveragePercent.blog.date < 100) {
    failures.push(`blog date 覆盖率过低：${coveragePercent.blog.date}% < 100%`)
  }

  for (const [key, capability] of Object.entries(siteCapabilities)) {
    if (!capability.enabled) {
      failures.push(`站点策略缺失：${key}`)
    }
  }

  if (!llmAssets.llmsEntry) {
    failures.push('缺少 llms.md 入口页面。')
  }
  if (!llmAssets.llmsIndexPublic) {
    failures.push('缺少 website/public/llms-index.json。')
  }

  if (result.quality.issues.length > 0) {
    failures.push(`质量问题未清零：${result.quality.issues.length} 项。`)
  }

  if (failures.length > 0) {
    const error = new Error(failures.join('\n'))
    error.name = 'SeoAuditStrictError'
    throw error
  }
}

export async function collectDocuments(relativePaths: string[]) {
  const documents: MarkdownDocument[] = []
  for (const relativePath of relativePaths) {
    documents.push(await readMarkdownDocument(relativePath))
  }
  return documents
}

export function pickQualityIssueCounts(quality: QualitySummary) {
  return quality.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] ?? 0) + 1
    return acc
  }, {})
}
