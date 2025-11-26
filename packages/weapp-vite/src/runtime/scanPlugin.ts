import type { App as AppJson, Plugin as PluginJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type {
  AppEntry,
  SubPackage,
  SubPackageMetaValue,
  SubPackageStyleConfigEntry,
  SubPackageStyleEntry,
  SubPackageStyleScope,
} from '../types'
import { isObject, removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../logger'
import { collectPluginExportEntries } from '../plugins/utils/analyze'
import { changeFileExtension, findJsEntry, findJsonEntry } from '../utils'

const SUPPORTED_SHARED_STYLE_EXTENSIONS = [
  '.wxss',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.styl',
  '.stylus',
  '.pcss',
  '.postcss',
  '.sss',
]
const SUPPORTED_SHARED_STYLE_EXTS = new Set(SUPPORTED_SHARED_STYLE_EXTENSIONS)
const BACKSLASH_RE = /\\/g

function toPosix(value: string) {
  return value.replace(BACKSLASH_RE, '/')
}

function isPathInside(parent: string, target: string) {
  const relative = path.relative(parent, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function resolveSubPackageEntries(subPackage: SubPackage): string[] {
  const entries: string[] = []
  const root = subPackage.root ?? ''
  if (Array.isArray(subPackage.pages)) {
    entries.push(...subPackage.pages.map(page => `${root}/${page}`))
  }
  if (subPackage.entry) {
    entries.push(`${root}/${removeExtensionDeep(subPackage.entry)}`)
  }
  entries.push(...collectPluginExportEntries((subPackage as any).plugins, root))
  return entries
}

function resolveStyleEntryAbsolutePath(
  source: string,
  subPackageRoot: string,
  configService: MutableCompilerContext['configService'],
): string | undefined {
  const service = configService
  if (!service) {
    return undefined
  }

  const trimmed = source.trim()
  if (!trimmed) {
    return undefined
  }

  const srcRoot = service.absoluteSrcRoot
  const absoluteSubRoot = path.resolve(srcRoot, subPackageRoot)
  const normalizedEntry = toPosix(trimmed)
  const normalizedRoot = toPosix(subPackageRoot)

  const candidates: string[] = []
  if (path.isAbsolute(trimmed)) {
    candidates.push(trimmed)
  }
  else if (normalizedEntry === normalizedRoot || normalizedEntry.startsWith(`${normalizedRoot}/`)) {
    candidates.push(path.resolve(srcRoot, trimmed))
  }
  else {
    candidates.push(path.resolve(absoluteSubRoot, trimmed))
    candidates.push(path.resolve(srcRoot, trimmed))
  }

  for (const candidate of candidates) {
    if (isPathInside(srcRoot, candidate)) {
      return candidate
    }
  }
}

interface ResolvedStyleConfig {
  source: string
  scope: SubPackageStyleScope
  include?: string | string[]
  exclude?: string | string[]
  explicitScope: boolean
}

function coerceScope(scope: unknown): SubPackageStyleScope {
  const value = typeof scope === 'string' ? scope.trim() : ''
  if (value === 'pages' || value === 'components') {
    return value
  }
  if (value && value !== 'all') {
    logger.warn(`[subpackages] 未识别的样式作用域 \`${value}\`，已按 \`all\` 处理。`)
  }
  return 'all'
}

function coerceStyleConfig(entry: SubPackageStyleConfigEntry): ResolvedStyleConfig | undefined {
  if (typeof entry === 'string') {
    const source = entry.trim()
    if (!source) {
      return undefined
    }
    return {
      source,
      scope: 'all',
      explicitScope: false,
    }
  }

  if (!entry || typeof entry !== 'object') {
    return undefined
  }

  const source = entry.source?.toString().trim()
  if (!source) {
    return undefined
  }

  const hasExplicitScope = Object.prototype.hasOwnProperty.call(entry, 'scope') && entry.scope != null
  const scope = hasExplicitScope ? coerceScope(entry.scope) : 'all'
  return {
    source,
    scope,
    include: entry.include,
    exclude: entry.exclude,
    explicitScope: hasExplicitScope,
  }
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function normalizeRoot(root: string) {
  return toPosix(root).replace(/^\/+|\/+$/g, '')
}

function normalizePattern(pattern: string, normalizedRoot: string): string | undefined {
  const trimmed = pattern.trim()
  if (!trimmed) {
    return undefined
  }

  let normalized = toPosix(trimmed)
  if (normalizedRoot && normalized.startsWith(`${normalizedRoot}/`)) {
    normalized = normalized.slice(normalizedRoot.length + 1)
  }
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }
  normalized = normalized.replace(/^\/+/, '')
  if (!normalized) {
    return '**/*'
  }
  if (normalized.endsWith('/')) {
    normalized = `${normalized}**`
  }
  return normalized
}

const DEFAULT_SCOPE_INCLUDES: Record<SubPackageStyleScope, string[]> = {
  all: ['**/*'],
  pages: ['pages/**'],
  components: ['components/**'],
}

const DEFAULT_SCOPED_FILES: Array<{ base: string, scope: SubPackageStyleScope }> = [
  { base: 'index', scope: 'all' },
  { base: 'pages', scope: 'pages' },
  { base: 'components', scope: 'components' },
]

const DEFAULT_SCOPED_EXTENSIONS = Array.from(SUPPORTED_SHARED_STYLE_EXTS)

function getRelativePathWithinSubPackage(pathname: string, normalizedRoot: string) {
  if (!normalizedRoot) {
    return pathname
  }
  if (pathname === normalizedRoot) {
    return ''
  }
  if (pathname.startsWith(`${normalizedRoot}/`)) {
    return pathname.slice(normalizedRoot.length + 1)
  }
  return pathname
}

function inferScopeFromRelativePath(relativePath: string | undefined): SubPackageStyleScope | undefined {
  if (!relativePath) {
    return undefined
  }
  const cleaned = relativePath.replace(/^\.\//, '')
  if (cleaned.includes('/')) {
    return undefined
  }
  const base = path.posix.basename(cleaned, path.posix.extname(cleaned))
  if (base === 'pages') {
    return 'pages'
  }
  if (base === 'components') {
    return 'components'
  }
  if (base === 'index') {
    return 'all'
  }
  return undefined
}

function resolveIncludePatterns(
  descriptor: Pick<ResolvedStyleConfig, 'scope' | 'include'>,
  normalizedRoot: string,
): string[] {
  const normalized = new Set<string>()
  for (const pattern of toArray(descriptor.include)) {
    const resolved = normalizePattern(pattern, normalizedRoot)
    if (resolved) {
      normalized.add(resolved)
    }
  }
  if (!normalized.size) {
    const defaults = DEFAULT_SCOPE_INCLUDES[descriptor.scope] ?? DEFAULT_SCOPE_INCLUDES.all
    for (const pattern of defaults) {
      const resolved = normalizePattern(pattern, normalizedRoot)
      if (resolved) {
        normalized.add(resolved)
      }
    }
  }
  return Array.from(normalized)
}

function resolveExcludePatterns(
  descriptor: Pick<ResolvedStyleConfig, 'exclude'>,
  normalizedRoot: string,
): string[] {
  const normalized = new Set<string>()
  for (const pattern of toArray(descriptor.exclude)) {
    const resolved = normalizePattern(pattern, normalizedRoot)
    if (resolved) {
      normalized.add(resolved)
    }
  }
  return Array.from(normalized)
}

function addStyleEntry(
  descriptor: ResolvedStyleConfig,
  absolutePath: string,
  posixOutput: string,
  root: string,
  normalizedRoot: string,
  dedupe: Set<string>,
  normalized: SubPackageStyleEntry[],
) {
  const include = resolveIncludePatterns({ scope: descriptor.scope, include: descriptor.include }, normalizedRoot)
  const exclude = resolveExcludePatterns({ exclude: descriptor.exclude }, normalizedRoot)
  include.sort()
  exclude.sort()

  if (!include.length) {
    logger.warn(`[subpackages] 分包 ${root} 样式入口 \`${descriptor.source}\` 缺少有效作用范围，已按 \`**/*\` 处理。`)
    include.push('**/*')
  }

  const key = JSON.stringify({
    file: posixOutput,
    include,
    exclude,
  })
  if (dedupe.has(key)) {
    return
  }
  dedupe.add(key)

  normalized.push({
    source: descriptor.source,
    absolutePath,
    outputRelativePath: posixOutput,
    inputExtension: path.extname(absolutePath).toLowerCase(),
    scope: descriptor.scope,
    include,
    exclude,
  })
}

function appendDefaultScopedStyleEntries(
  root: string,
  normalizedRoot: string,
  service: NonNullable<MutableCompilerContext['configService']>,
  dedupe: Set<string>,
  normalized: SubPackageStyleEntry[],
) {
  const absoluteSubRoot = path.resolve(service.absoluteSrcRoot, root)
  for (const { base, scope } of DEFAULT_SCOPED_FILES) {
    for (const ext of DEFAULT_SCOPED_EXTENSIONS) {
      const filename = `${base}${ext}`
      const absolutePath = path.resolve(absoluteSubRoot, filename)
      if (!fs.existsSync(absolutePath)) {
        continue
      }
      const descriptor: ResolvedStyleConfig = {
        source: filename,
        scope,
        include: undefined,
        exclude: undefined,
        explicitScope: true,
      }
      const outputAbsolutePath = changeFileExtension(absolutePath, service.outputExtensions.wxss)
      const outputRelativePath = service.relativeOutputPath(outputAbsolutePath)
      if (!outputRelativePath) {
        continue
      }
      const posixOutput = toPosix(outputRelativePath)
      addStyleEntry(descriptor, absolutePath, posixOutput, root, normalizedRoot, dedupe, normalized)
      break
    }
  }
}

function normalizeSubPackageStyleEntries(
  styles: SubPackageStyleConfigEntry | SubPackageStyleConfigEntry[] | undefined,
  subPackage: SubPackage,
  configService: MutableCompilerContext['configService'],
): SubPackageStyleEntry[] | undefined {
  const service = configService
  if (!service) {
    return undefined
  }

  const root = subPackage.root?.trim()
  if (!root) {
    return undefined
  }

  const list = styles === undefined
    ? []
    : Array.isArray(styles) ? styles : [styles]

  const normalizedRoot = normalizeRoot(root)
  const normalized: SubPackageStyleEntry[] = []
  const dedupe = new Set<string>()
  for (const entry of list) {
    const descriptor = coerceStyleConfig(entry)
    if (!descriptor) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口配置无效，已忽略。`)
      continue
    }

    const absolutePath = resolveStyleEntryAbsolutePath(descriptor.source, root, service)
    if (!absolutePath) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口 \`${descriptor.source}\` 解析失败，已忽略。`)
      continue
    }

    if (!fs.existsSync(absolutePath)) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口 \`${descriptor.source}\` 对应文件不存在，已忽略。`)
      continue
    }

    const ext = path.extname(absolutePath).toLowerCase()
    if (!SUPPORTED_SHARED_STYLE_EXTS.has(ext)) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口 \`${descriptor.source}\` 当前仅支持以下格式：${SUPPORTED_SHARED_STYLE_EXTENSIONS.join(', ')}，已忽略。`)
      continue
    }

    const outputAbsolutePath = changeFileExtension(absolutePath, service.outputExtensions.wxss)
    const outputRelativePath = service.relativeOutputPath(outputAbsolutePath)
    if (!outputRelativePath) {
      logger.warn(`[subpackages] 分包 ${root} 样式入口 \`${descriptor.source}\` 不在项目源码目录内，已忽略。`)
      continue
    }

    const posixOutput = toPosix(outputRelativePath)
    const relativeWithinRoot = getRelativePathWithinSubPackage(posixOutput, normalizedRoot)
    const inferredScope = descriptor.explicitScope
      ? undefined
      : inferScopeFromRelativePath(relativeWithinRoot)

    const resolvedDescriptor: ResolvedStyleConfig = {
      ...descriptor,
      scope: inferredScope ?? descriptor.scope,
    }

    addStyleEntry(resolvedDescriptor, absolutePath, posixOutput, root, normalizedRoot, dedupe, normalized)
  }

  appendDefaultScopedStyleEntries(root, normalizedRoot, service, dedupe, normalized)

  return normalized.length ? normalized : undefined
}
export interface ScanService {
  appEntry?: AppEntry
  pluginJson?: PluginJson
  pluginJsonPath?: string
  subPackageMap: Map<string, SubPackageMetaValue>
  independentSubPackageMap: Map<string, SubPackageMetaValue>
  loadAppEntry: () => Promise<AppEntry>
  loadSubPackages: () => SubPackageMetaValue[]
  isMainPackageFileName: (fileName: string) => boolean
  readonly workersOptions: AppJson['workers'] | undefined
  readonly workersDir: string | undefined
  markDirty: () => void
  markIndependentDirty: (root: string) => void
  drainIndependentDirtyRoots: () => string[]
}

function createScanService(ctx: MutableCompilerContext): ScanService {
  const scanState = ctx.runtimeState.scan
  const { subPackageMap, independentSubPackageMap, independentDirtyRoots } = scanState

  async function loadAppEntry() {
    if (!ctx.configService || !ctx.jsonService) {
      throw new Error('configService/jsonService must be initialized before scanning entries')
    }

    if (scanState.appEntry && !scanState.isDirty) {
      return scanState.appEntry
    }

    const appDirname = ctx.configService.absoluteSrcRoot
    const appBasename = path.resolve(appDirname, 'app')
    const { path: appConfigFile } = await findJsonEntry(appBasename)
    const { path: appEntryPath } = await findJsEntry(appBasename)

    if (ctx.configService.absolutePluginRoot) {
      const pluginBasename = path.resolve(ctx.configService.absolutePluginRoot, 'plugin')
      const { path: pluginConfigFile } = await findJsonEntry(pluginBasename)
      if (pluginConfigFile) {
        const pluginConfig = await ctx.jsonService.read(pluginConfigFile) as unknown as PluginJson
        scanState.pluginJson = pluginConfig
        scanState.pluginJsonPath = pluginConfigFile
      }
      else {
        scanState.pluginJson = undefined
        scanState.pluginJsonPath = undefined
      }
    }

    if (appEntryPath && appConfigFile) {
      const config = await ctx.jsonService.read(appConfigFile) as unknown as AppJson & {
        subpackages: SubPackage[]
        subPackages: SubPackage[]
      }
      if (isObject(config)) {
        const resolvedAppEntry: AppEntry = {
          path: appEntryPath,
          json: config,
          jsonPath: appConfigFile,
          type: 'app',
        }

        scanState.appEntry = resolvedAppEntry

        const { sitemapLocation = 'sitemap.json', themeLocation = 'theme.json' } = config
        if (sitemapLocation) {
          const { path: sitemapJsonPath } = await findJsonEntry(path.resolve(appDirname, sitemapLocation))
          if (sitemapJsonPath) {
            resolvedAppEntry.sitemapJsonPath = sitemapJsonPath
            resolvedAppEntry.sitemapJson = await ctx.jsonService.read(sitemapJsonPath) as SitemapJson
          }
        }
        if (themeLocation) {
          const { path: themeJsonPath } = await findJsonEntry(path.resolve(appDirname, themeLocation))
          if (themeJsonPath) {
            resolvedAppEntry.themeJsonPath = themeJsonPath
            resolvedAppEntry.themeJson = await ctx.jsonService.read(themeJsonPath) as ThemeJson
          }
        }

        scanState.appEntry = resolvedAppEntry
        return resolvedAppEntry
      }

      throw new Error('`app.json` 解析失败，请确保 `app.json` 文件格式正确')
    }

    throw new Error(`在 ${appDirname} 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径  `)
  }

  function loadSubPackages(): SubPackageMetaValue[] {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before scanning subpackages')
    }

    const json = scanState.appEntry?.json

    if (scanState.isDirty || subPackageMap.size === 0) {
      subPackageMap.clear()
      independentSubPackageMap.clear()
      if (scanState.isDirty) {
        independentDirtyRoots.clear()
      }

      if (json) {
        const metas: SubPackageMetaValue[] = []
        const independentSubPackages = [
          ...json.subPackages ?? [],
          ...json.subpackages ?? [],
        ] as SubPackage[]
        for (const subPackage of independentSubPackages) {
          const meta: SubPackageMetaValue = {
            subPackage,
            entries: resolveSubPackageEntries(subPackage),
          }
          const subPackageConfig = ctx.configService.weappViteConfig?.subPackages?.[subPackage.root!]
          meta.subPackage.dependencies = subPackageConfig?.dependencies
          meta.subPackage.inlineConfig = subPackageConfig?.inlineConfig
          meta.autoImportComponents = subPackageConfig?.autoImportComponents
          meta.styleEntries = normalizeSubPackageStyleEntries(
            subPackageConfig?.styles,
            subPackage,
            ctx.configService,
          )
          meta.watchSharedStyles = subPackageConfig?.watchSharedStyles ?? true
          metas.push(meta)
          if (subPackage.root) {
            subPackageMap.set(subPackage.root, meta)
            if (subPackage.independent) {
              independentSubPackageMap.set(subPackage.root, meta)
              if (scanState.isDirty) {
                independentDirtyRoots.add(subPackage.root)
              }
            }
          }
        }
      }

      scanState.isDirty = false
    }
    else {
      for (const meta of subPackageMap.values()) {
        meta.entries = resolveSubPackageEntries(meta.subPackage)
      }
    }

    if (scanState.appEntry) {
      return Array.from(subPackageMap.values())
    }

    throw new Error(`在 ${ctx.configService.absoluteSrcRoot} 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径  `)
  }

  function isMainPackageFileName(fileName: string) {
    return Array.from(independentSubPackageMap.keys()).every((root) => {
      return !fileName.startsWith(root)
    })
  }

  return {
    get appEntry() {
      return scanState.appEntry
    },
    set appEntry(value: AppEntry | undefined) {
      scanState.appEntry = value
    },
    get pluginJson() {
      return scanState.pluginJson
    },
    set pluginJson(value: PluginJson | undefined) {
      scanState.pluginJson = value
    },
    get pluginJsonPath() {
      return scanState.pluginJsonPath
    },
    set pluginJsonPath(value: string | undefined) {
      scanState.pluginJsonPath = value
    },
    subPackageMap,
    independentSubPackageMap,
    async loadAppEntry() {
      return await loadAppEntry()
    },
    loadSubPackages,
    isMainPackageFileName,
    get workersOptions() {
      return scanState.appEntry?.json?.workers
    },
    get workersDir() {
      const workersOptions = scanState.appEntry?.json?.workers
      return typeof workersOptions === 'object' ? workersOptions?.path : workersOptions
    },
    markDirty() {
      scanState.isDirty = true
      scanState.appEntry = undefined
      scanState.pluginJson = undefined
      scanState.pluginJsonPath = undefined
    },
    markIndependentDirty(root: string) {
      if (!root) {
        return
      }
      if (independentSubPackageMap.has(root)) {
        independentDirtyRoots.add(root)
      }
    },
    drainIndependentDirtyRoots() {
      const roots = Array.from(independentDirtyRoots)
      independentDirtyRoots.clear()
      return roots
    },
  }
}

export function createScanServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createScanService(ctx)
  ctx.scanService = service

  return {
    name: 'weapp-runtime:scan-service',
    async buildStart() {
      await service.loadAppEntry()
      service.loadSubPackages()
    },
  }
}
