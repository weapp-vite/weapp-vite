import type { OutputAsset, RolldownOutput } from 'rolldown'
import type { SubPackageDescriptor } from '../subpackages/types'
import type {
  AnalyzeComponentJsonConfig,
  AnalyzeComponentPageUsage,
  AnalyzeComponentSuggestion,
  AnalyzeComponentUsage,
} from './types'
import { posix as path } from 'pathe'
import { createComponentSuggestion } from './suggestions'

interface ComponentEdge {
  owner: string
  component: string
  placeholderCovered: boolean
}

interface ComponentUsageAccumulator {
  component: string
  componentPackage: string
  totalUsageCount: number
  pages: Map<string, AnalyzeComponentPageUsage>
  crossPackageUsageCount: number
  placeholderCoveredCrossPackageUsageCount: number
}

interface AnalyzeComponentUsageOptions {
  jsonConfigs: AnalyzeComponentJsonConfig[]
  subPackages: SubPackageDescriptor[]
}

function normalizeRoute(value: string) {
  return path.normalize(value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.json$/, ''))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : []
}

function readUsingComponents(config: unknown) {
  if (!isRecord(config) || !isRecord(config.usingComponents)) {
    return []
  }

  return Object.entries(config.usingComponents)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
}

function readComponentPlaceholder(config: unknown) {
  if (!isRecord(config) || !isRecord(config.componentPlaceholder)) {
    return new Set<string>()
  }

  return new Set(Object.keys(config.componentPlaceholder))
}

function resolveComponentRoute(owner: string, request: string) {
  const normalizedRequest = request.replace(/\\/g, '/').trim()
  if (!normalizedRequest || normalizedRequest.startsWith('plugin://')) {
    return undefined
  }

  if (normalizedRequest.startsWith('.')) {
    return normalizeRoute(path.join(path.dirname(owner), normalizedRequest))
  }

  if (normalizedRequest.startsWith('/')) {
    return normalizeRoute(normalizedRequest)
  }

  return normalizeRoute(normalizedRequest)
}

function resolvePackageId(route: string, subPackages: SubPackageDescriptor[]) {
  const matched = subPackages
    .map(item => item.root)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find(root => route === root || route.startsWith(`${root}/`))

  return matched ?? '__main__'
}

function collectAppPages(configs: Map<string, unknown>) {
  const appJson = configs.get('app')
  if (!isRecord(appJson)) {
    return new Set<string>()
  }

  const pages = new Set<string>()
  for (const page of toStringArray(appJson.pages)) {
    pages.add(normalizeRoute(page))
  }

  const subPackages = Array.isArray(appJson.subPackages)
    ? appJson.subPackages
    : Array.isArray(appJson.subpackages)
      ? appJson.subpackages
      : []

  for (const item of subPackages) {
    if (!isRecord(item) || typeof item.root !== 'string') {
      continue
    }
    for (const page of toStringArray(item.pages)) {
      pages.add(normalizeRoute(path.join(item.root, page)))
    }
  }

  return pages
}

function registerUsage(
  usageMap: Map<string, ComponentUsageAccumulator>,
  edge: ComponentEdge,
  page: string,
  pagePackage: string,
  componentPackage: string,
) {
  const usage = usageMap.get(edge.component) ?? {
    component: edge.component,
    componentPackage,
    totalUsageCount: 0,
    pages: new Map<string, AnalyzeComponentPageUsage>(),
    crossPackageUsageCount: 0,
    placeholderCoveredCrossPackageUsageCount: 0,
  }

  usage.totalUsageCount += 1
  const pageUsage = usage.pages.get(page) ?? {
    page,
    packageId: pagePackage,
    usageCount: 0,
  }
  pageUsage.usageCount += 1
  usage.pages.set(page, pageUsage)

  if (pagePackage !== componentPackage) {
    usage.crossPackageUsageCount += 1
    if (edge.placeholderCovered) {
      usage.placeholderCoveredCrossPackageUsageCount += 1
    }
  }

  usageMap.set(edge.component, usage)
}

export function collectAnalyzeComponentJsonConfigs(output: RolldownOutput | undefined): AnalyzeComponentJsonConfig[] {
  if (!output) {
    return []
  }

  const configs: AnalyzeComponentJsonConfig[] = []
  for (const item of output.output ?? []) {
    if (item.type !== 'asset' || !item.fileName.endsWith('.json')) {
      continue
    }

    const asset = item as OutputAsset
    if (typeof asset.source !== 'string') {
      continue
    }

    try {
      configs.push({
        file: normalizeRoute(asset.fileName),
        config: JSON.parse(asset.source) as unknown,
      })
    }
    catch {
      // analyze 只消费合法 JSON 产物，解析失败时保留现有包体分析结果。
    }
  }

  return configs
}

export function analyzeComponentUsage(options: AnalyzeComponentUsageOptions): AnalyzeComponentUsage[] {
  const configs = new Map<string, unknown>()
  for (const item of options.jsonConfigs) {
    configs.set(normalizeRoute(item.file), item.config)
  }

  const pages = collectAppPages(configs)
  const graph = new Map<string, ComponentEdge[]>()
  const packageMap = new Map<string, string>()

  for (const route of configs.keys()) {
    packageMap.set(route, resolvePackageId(route, options.subPackages))
  }

  for (const [owner, config] of configs) {
    const placeholders = readComponentPlaceholder(config)
    const edges = readUsingComponents(config)
      .map(([name, request]) => {
        const component = resolveComponentRoute(owner, request)
        return component && configs.has(component)
          ? { owner, component, placeholderCovered: placeholders.has(name) }
          : undefined
      })
      .filter((edge): edge is ComponentEdge => Boolean(edge))

    if (edges.length > 0) {
      graph.set(owner, edges)
    }
  }

  const usageMap = new Map<string, ComponentUsageAccumulator>()

  const visit = (owner: string, page: string, stack: Set<string>) => {
    for (const edge of graph.get(owner) ?? []) {
      const componentPackage = packageMap.get(edge.component) ?? '__main__'
      const pagePackage = packageMap.get(page) ?? '__main__'
      registerUsage(usageMap, edge, page, pagePackage, componentPackage)

      if (stack.has(edge.component)) {
        continue
      }

      const nextStack = new Set(stack)
      nextStack.add(edge.component)
      visit(edge.component, page, nextStack)
    }
  }

  for (const page of pages) {
    visit(page, page, new Set([page]))
  }

  return Array.from(usageMap.values())
    .map((usage) => {
      const pages = Array.from(usage.pages.values())
        .sort((left, right) => left.page.localeCompare(right.page))
      const suggestions = [createComponentSuggestion(usage)]
        .filter((item): item is AnalyzeComponentSuggestion => Boolean(item))

      return {
        component: usage.component,
        componentPackage: usage.componentPackage,
        totalUsageCount: usage.totalUsageCount,
        pageUsageCount: pages.length,
        pages,
        suggestions,
      }
    })
    .sort((left, right) => {
      const usageDelta = right.totalUsageCount - left.totalUsageCount
      return usageDelta !== 0 ? usageDelta : left.component.localeCompare(right.component)
    })
}

export type {
  AnalyzeComponentJsonConfig,
  AnalyzeComponentPageUsage,
  AnalyzeComponentSuggestion,
  AnalyzeComponentSuggestionKind,
  AnalyzeComponentUsage,
} from './types'
