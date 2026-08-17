import type { CompilerContext } from '../context'
import type { MpPlatform } from '../types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { findJsEntry, findTemplateEntry, findVueEntry } from '../utils'
import { collectPreloadPages, findPreloadRuleKey, suggestPreloadRules } from '../utils/preloadRule'

export interface PreloadAnalyzeSuggestion {
  page: string
  packages: string[]
  evidence: Array<{
    target: string
    packageRoot: string
    source: 'template' | 'script'
  }>
  alreadyConfigured: string[]
}

export interface PreloadAnalyzeResult {
  runtime: 'mini'
  kind: 'preload'
  generatedAt: string
  platform: MpPlatform
  pages: string[]
  configuredRules: Record<string, unknown>
  suggestions: PreloadAnalyzeSuggestion[]
  uncoveredPages: string[]
  limitations: string[]
}

async function readFileIfExists(filePath?: string) {
  if (!filePath) {
    return undefined
  }
  try {
    return await fs.readFile(filePath, 'utf8')
  }
  catch {
    return undefined
  }
}

function splitVueSource(source: string, filename: string) {
  try {
    const { descriptor } = parseSfc(source, { filename })
    return {
      template: descriptor.template?.content,
      script: [descriptor.script?.content, descriptor.scriptSetup?.content]
        .filter((content): content is string => Boolean(content))
        .join('\n'),
    }
  }
  catch {
    return {
      template: source,
      script: source,
    }
  }
}

async function collectPageSources(ctx: CompilerContext, route: string) {
  const base = path.resolve(ctx.configService.absoluteSrcRoot, route)
  const [templateEntry, scriptEntry, vueEntry] = await Promise.all([
    findTemplateEntry(base, ctx.configService.platform),
    findJsEntry(base),
    findVueEntry(base),
  ])
  if (vueEntry) {
    const source = await readFileIfExists(vueEntry)
    return source ? splitVueSource(source, vueEntry) : {}
  }
  const [template, script] = await Promise.all([
    readFileIfExists(templateEntry.path),
    readFileIfExists(scriptEntry.path),
  ])
  return { template, script }
}

function aggregateSuggestions(
  result: ReturnType<typeof suggestPreloadRules>,
  configuredRules: Record<string, unknown>,
) {
  const byPage = new Map<string, PreloadAnalyzeSuggestion>()
  for (const suggestion of result.suggestions) {
    const current = byPage.get(suggestion.page) ?? {
      page: suggestion.page,
      packages: [],
      evidence: [],
      alreadyConfigured: [],
    }
    if (!current.packages.includes(suggestion.packageRoot)) {
      current.packages.push(suggestion.packageRoot)
    }
    current.evidence.push({
      target: suggestion.target,
      packageRoot: suggestion.packageRoot,
      source: suggestion.source,
    })

    const configuredKey = findPreloadRuleKey(suggestion.page, configuredRules)
    const existingRule = configuredKey === undefined ? undefined : configuredRules[configuredKey]
    const existingPackages = existingRule && typeof existingRule === 'object' && 'packages' in existingRule
      ? (existingRule as { packages?: unknown }).packages
      : undefined
    if (Array.isArray(existingPackages) && existingPackages.includes(suggestion.packageRoot)) {
      current.alreadyConfigured.push(suggestion.packageRoot)
    }
    byPage.set(suggestion.page, current)
  }

  return [...byPage.values()].map(suggestion => ({
    ...suggestion,
    packages: suggestion.packages.sort(),
    alreadyConfigured: [...new Set(suggestion.alreadyConfigured)].sort(),
    evidence: suggestion.evidence.sort((left, right) => left.target.localeCompare(right.target)),
  }))
}

export async function analyzePreloadRules(ctx: CompilerContext, now = new Date()): Promise<PreloadAnalyzeResult> {
  const appEntry = await ctx.scanService.loadAppEntry()
  const appJson = appEntry.json as Record<string, unknown>
  const pages = collectPreloadPages(appJson)
  const pageSources = new Map<string, { template?: string, script?: string }>()
  const sourceEntries = await Promise.all(pages.map(async page => [
    page.route,
    await collectPageSources(ctx, page.route),
  ] as const))
  for (const [route, source] of sourceEntries) {
    pageSources.set(route, source)
  }

  const configuredRules = appJson.preloadRule && typeof appJson.preloadRule === 'object'
    ? appJson.preloadRule as Record<string, unknown>
    : {}
  const suggestions = suggestPreloadRules(appJson, pageSources)
  return {
    runtime: 'mini',
    kind: 'preload',
    generatedAt: now.toISOString(),
    platform: ctx.configService.platform,
    pages: pages.map(page => page.route),
    configuredRules,
    suggestions: aggregateSuggestions(suggestions, configuredRules),
    uncoveredPages: suggestions.uncovered,
    limitations: [
      '仅分析静态路由字面量；动态路由、后端配置和运行时守卫不会被推断。',
      '建议使用分包 root 作为 packages 值，正式启用前仍需结合业务访问频率和 2 MB 预下载额度复核。',
      '该命令只提供可审计建议，不会自动修改源码或覆盖手写的 app.json.preloadRule。',
    ],
  }
}
