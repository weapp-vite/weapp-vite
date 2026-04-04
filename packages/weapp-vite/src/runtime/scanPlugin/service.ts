import type { App as AppJson, Plugin as PluginJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { MutableCompilerContext } from '../../context'
import type {
  AppEntry,
  SubPackage,
  SubPackageMetaValue,
} from '../../types'
import { isObject } from '@weapp-core/shared'
import path from 'pathe'
import logger from '../../logger'
import { findJsEntry, findJsonEntry, findVueEntry } from '../../utils'
import { requireConfigService } from '../utils/requireConfigService'
import { normalizeSubPackageStyleEntries } from './styleEntries'
import { resolveSubPackageEntries } from './subpackages'

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

export function resolveScanAppBasename(absoluteSrcRoot: string) {
  return path.resolve(absoluteSrcRoot, 'app')
}

export function resolveScanPluginBasename(absolutePluginRoot?: string) {
  return absolutePluginRoot ? path.resolve(absolutePluginRoot, 'plugin') : undefined
}

export function resolveScanJsonEntryBasename(
  appDirname: string,
  location: unknown,
  fallbackName: string,
) {
  const value = typeof location === 'string' ? location : undefined
  if (value === '') {
    return undefined
  }
  return path.resolve(appDirname, value || fallbackName)
}

export function createScanService(ctx: MutableCompilerContext): ScanService {
  const scanState = ctx.runtimeState.scan
  const {
    subPackageMap,
    independentSubPackageMap,
    independentDirtyRoots,
    warnedMessages,
  } = scanState

  function warnOnce(message: string) {
    if (warnedMessages.has(message)) {
      return
    }
    warnedMessages.add(message)
    logger.warn(message)
  }

  function mergeAutoRoutePages(
    pages: AppJson['pages'] | undefined,
    routePages: string[],
  ) {
    if (routePages.length === 0) {
      return pages
    }

    const existingPages = Array.isArray(pages) ? pages.filter(page => typeof page === 'string' && page.length > 0) : []
    const existingSet = new Set(existingPages)
    const hasAllRoutePages = routePages.every(page => existingSet.has(page))
    if (hasAllRoutePages) {
      return existingPages
    }

    return [
      ...routePages,
      ...existingPages.filter(page => !routePages.includes(page)),
    ]
  }

  function mergeAutoRouteSubPackages(
    subPackages: SubPackage[] | undefined,
    routeSubPackages: { root: string, pages: string[] }[],
  ) {
    if (routeSubPackages.length === 0) {
      return subPackages
    }

    const merged = new Map<string, SubPackage>()
    const anonymousEntries: SubPackage[] = []
    const existingEntries = Array.isArray(subPackages) ? subPackages : []

    for (const entry of existingEntries) {
      if (!entry?.root) {
        anonymousEntries.push(entry)
        continue
      }
      merged.set(entry.root, {
        ...entry,
        pages: Array.isArray(entry.pages) ? [...entry.pages] : [],
      })
    }

    let changed = false
    for (const routeSubPackage of routeSubPackages) {
      const existingEntry = merged.get(routeSubPackage.root)
      if (!existingEntry) {
        merged.set(routeSubPackage.root, {
          root: routeSubPackage.root,
          pages: [...routeSubPackage.pages],
        })
        changed = true
        continue
      }

      const existingPages = Array.isArray(existingEntry.pages) ? existingEntry.pages : []
      const existingPageSet = new Set(existingPages)
      const hasAllPages = routeSubPackage.pages.every(page => existingPageSet.has(page))
      if (hasAllPages) {
        continue
      }

      existingEntry.pages = [
        ...routeSubPackage.pages,
        ...existingPages.filter(page => !routeSubPackage.pages.includes(page)),
      ]
      changed = true
    }

    if (!changed && anonymousEntries.length === 0) {
      return existingEntries
    }

    return [
      ...merged.values(),
      ...anonymousEntries,
    ]
  }

  async function applyAutoRoutesToAppConfigIfNeeded(
    config: AppJson & { subpackages?: SubPackage[], subPackages?: SubPackage[] },
  ) {
    const autoRoutesService = ctx.autoRoutesService
    if (!autoRoutesService?.isEnabled()) {
      return config
    }

    if (ctx.runtimeState.autoRoutes.loadingAppConfig) {
      return config
    }

    ctx.runtimeState.autoRoutes.loadingAppConfig = true
    try {
      await autoRoutesService.ensureFresh()
    }
    finally {
      ctx.runtimeState.autoRoutes.loadingAppConfig = false
    }
    const routes = autoRoutesService.getReference()
    config.pages = mergeAutoRoutePages(config.pages, routes.pages)

    const mergedSubPackages = mergeAutoRouteSubPackages(
      config.subPackages ?? config.subpackages,
      routes.subPackages.map(subPackage => ({
        root: subPackage.root,
        pages: [...subPackage.pages],
      })),
    )
    if (mergedSubPackages) {
      config.subPackages = mergedSubPackages
    }

    return config
  }

  async function loadAppEntry() {
    if (!ctx.configService || !ctx.jsonService) {
      throw new Error('扫描入口前必须初始化 configService/jsonService。')
    }

    if (scanState.appEntry && !scanState.isDirty) {
      return scanState.appEntry
    }

    const appDirname = ctx.configService.absoluteSrcRoot
    const appBasename = resolveScanAppBasename(appDirname)
    let { path: appConfigFile } = await findJsonEntry(appBasename)
    const discoveredAppConfigFile = appConfigFile
    const { path: appEntryPath } = await findJsEntry(appBasename)
    const vueAppPath = await findVueEntry(appBasename)

    // 如果找不到 app.json，尝试从 app.vue 提取配置；并在缺少 app.ts/js 时使用 app.vue 作为入口。
    let configFromVue: Record<string, any> | undefined
    if (!appConfigFile && vueAppPath) {
      const { extractConfigFromVue } = await import('../../utils/file')
      configFromVue = await extractConfigFromVue(vueAppPath)
      if (configFromVue) {
        // 创建一个虚拟的 appConfigFile 路径（指向 .vue 文件）
        appConfigFile = vueAppPath
      }
    }

    if (appEntryPath && vueAppPath) {
      warnOnce(`[app] 检测到 ${path.basename(appEntryPath)} 与 ${path.basename(vueAppPath)} 同时存在，当前将优先使用 ${path.basename(appEntryPath)} 作为应用入口，${path.basename(vueAppPath)} 将被忽略。`)
    }
    if (discoveredAppConfigFile && vueAppPath) {
      warnOnce(`[app] 检测到 ${path.basename(discoveredAppConfigFile)} 与 ${path.basename(vueAppPath)} 同时存在，当前将优先使用 ${path.basename(discoveredAppConfigFile)} 作为应用配置来源，${path.basename(vueAppPath)} 中的 app 配置不会生效。`)
    }

    if (ctx.configService.absolutePluginRoot) {
      const pluginBasename = resolveScanPluginBasename(ctx.configService.absolutePluginRoot)!
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

    // 如果有 appEntryPath 或 appConfigFile (来自 .vue)
    if ((appEntryPath || vueAppPath) && appConfigFile) {
      let config: AppJson & { subpackages?: SubPackage[], subPackages?: SubPackage[] }

      // 如果配置来自 .vue 文件，直接使用提取的配置
      if (configFromVue) {
        config = configFromVue as AppJson & { subpackages?: SubPackage[], subPackages?: SubPackage[] }
      }
      else {
        config = await ctx.jsonService.read(appConfigFile) as unknown as AppJson & {
          subpackages: SubPackage[]
          subPackages: SubPackage[]
        }
      }
      await applyAutoRoutesToAppConfigIfNeeded(config)

      if (isObject(config)) {
        // 使用 appEntryPath，如果不存在则使用 vueAppPath
        const finalEntryPath = appEntryPath || vueAppPath!
        const resolvedAppEntry: AppEntry = {
          path: finalEntryPath,
          json: config,
          jsonPath: appConfigFile,
          type: 'app',
        }

        scanState.appEntry = resolvedAppEntry

        const sitemapBasename = resolveScanJsonEntryBasename(appDirname, config.sitemapLocation, 'sitemap.json')
        const themeBasename = resolveScanJsonEntryBasename(appDirname, config.themeLocation, 'theme.json')
        if (sitemapBasename) {
          const { path: sitemapJsonPath } = await findJsonEntry(sitemapBasename)
          if (sitemapJsonPath) {
            resolvedAppEntry.sitemapJsonPath = sitemapJsonPath
            resolvedAppEntry.sitemapJson = await ctx.jsonService.read(sitemapJsonPath) as SitemapJson
          }
        }
        if (themeBasename) {
          const { path: themeJsonPath } = await findJsonEntry(themeBasename)
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

    throw new Error(`在 ${appDirname} 目录下没有找到 \`app.json\` 或 \`app.vue\`，请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径`)
  }

  function loadSubPackages(): SubPackageMetaValue[] {
    const configService = requireConfigService(ctx, '扫描分包前必须初始化 configService。')

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
          const subPackageConfig = configService.weappViteConfig?.subPackages?.[subPackage.root!]
          const npmSubPackageConfig = configService.weappViteConfig?.npm?.subPackages?.[subPackage.root!]
          const resolvedSubPackage = {
            ...subPackage,
            dependencies: npmSubPackageConfig?.dependencies,
            inlineConfig: subPackageConfig?.inlineConfig,
          }
          const meta: SubPackageMetaValue = {
            subPackage: resolvedSubPackage,
            entries: resolveSubPackageEntries(resolvedSubPackage),
          }
          meta.autoImportComponents = subPackageConfig?.autoImportComponents
          meta.styleEntries = normalizeSubPackageStyleEntries(
            subPackageConfig?.styles,
            resolvedSubPackage,
            configService,
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
      return [...subPackageMap.values()]
    }

    throw new Error(`在 ${configService.absoluteSrcRoot} 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径  `)
  }

  function isMainPackageFileName(fileName: string) {
    return [...independentSubPackageMap.keys()].every((root) => {
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
      const roots = [...independentDirtyRoots]
      independentDirtyRoots.clear()
      return roots
    },
  }
}
