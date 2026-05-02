import type { App as AppJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { MutableCompilerContext } from '../../../context'
import type { AppEntry, SubPackage } from '../../../types'
import type { ScanServiceStateLike } from './shared'
import { isObject } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { jsExtensions } from '../../../constants'
import { findJsEntry, findJsonEntry, findVueEntry } from '../../../utils'
import { createWarnOnce, mergeAutoRoutePages } from './shared'

export function resolveScanAppBasename(absoluteSrcRoot: string) {
  return path.resolve(absoluteSrcRoot, 'app')
}

export function resolveScanAppPreludeBasename(absoluteSrcRoot: string) {
  return path.resolve(absoluteSrcRoot, 'app.prelude')
}

async function resolveScanAppPreludePath(absoluteSrcRoot: string) {
  const basename = resolveScanAppPreludeBasename(absoluteSrcRoot)
  for (const extension of jsExtensions) {
    const candidate = `${basename}.${extension}`
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }
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

function normalizeAppConfigSubPackages(
  config: AppJson & { subpackages?: SubPackage[], subPackages?: SubPackage[] },
) {
  const subPackages = Array.isArray(config.subPackages)
    ? config.subPackages
    : Array.isArray(config.subpackages)
      ? config.subpackages
      : []

  ;(config as any).subPackages = subPackages.map(subPackage => ({
    ...subPackage,
    pages: Array.isArray(subPackage?.pages) ? subPackage.pages : [],
  }))

  return config
}

async function applyAutoRoutesToAppConfigIfNeeded(
  ctx: MutableCompilerContext,
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
  config.pages = mergeAutoRoutePages(config.pages, routes.pages) ?? []

  const mergedSubPackages = mergeAutoRouteSubPackages(
    config.subPackages ?? config.subpackages,
    routes.subPackages.map(subPackage => ({
      root: subPackage.root,
      pages: [...subPackage.pages],
    })),
  )
  if (mergedSubPackages) {
    const normalizedSubPackages = mergedSubPackages.map(subPackage => ({
      ...subPackage,
      pages: Array.isArray(subPackage.pages) ? subPackage.pages : [],
    })) as SubPackage[]
    ;(config as any).subPackages = normalizedSubPackages
  }

  return normalizeAppConfigSubPackages(config)
}

export async function loadAppEntry(ctx: MutableCompilerContext, scanState: ScanServiceStateLike) {
  if (!ctx.configService || !ctx.jsonService) {
    throw new Error('扫描入口前必须初始化 configService/jsonService。')
  }

  if (scanState.appEntry && !scanState.isDirty) {
    return scanState.appEntry
  }

  const warnOnce = createWarnOnce(scanState.warnedMessages)
  const appDirname = ctx.configService.absoluteSrcRoot
  const appBasename = resolveScanAppBasename(appDirname)
  let { path: appConfigFile } = await findJsonEntry(appBasename)
  const discoveredAppConfigFile = appConfigFile
  const { path: appEntryPath } = await findJsEntry(appBasename)
  const appPreludePath = await resolveScanAppPreludePath(appDirname)
  const vueAppPath = await findVueEntry(appBasename)

  let configFromVue: Record<string, any> | undefined
  if (!appConfigFile && vueAppPath) {
    const { extractConfigFromVue } = await import('../../../utils/file')
    configFromVue = await extractConfigFromVue(vueAppPath)
    if (configFromVue) {
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
      const pluginConfig = await ctx.jsonService.read(pluginConfigFile) as any
      scanState.pluginJson = pluginConfig
      scanState.pluginJsonPath = pluginConfigFile
    }
    else {
      scanState.pluginJson = undefined
      scanState.pluginJsonPath = undefined
    }
  }

  if ((appEntryPath || vueAppPath) && appConfigFile) {
    let config: AppJson & { subpackages?: SubPackage[], subPackages?: SubPackage[] }

    if (configFromVue) {
      config = configFromVue as AppJson & { subpackages?: SubPackage[], subPackages?: SubPackage[] }
    }
    else {
      config = await ctx.jsonService.read(appConfigFile) as unknown as AppJson & {
        subpackages: SubPackage[]
        subPackages: SubPackage[]
      }
    }
    await applyAutoRoutesToAppConfigIfNeeded(ctx, config)

    if (isObject(config)) {
      normalizeAppConfigSubPackages(config)
      const finalEntryPath = appEntryPath || vueAppPath!
      const resolvedAppEntry: AppEntry = {
        path: finalEntryPath,
        preludePath: appPreludePath,
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

  throw new Error(`在 ${appDirname} 目录下没有找到 \`app.json\` 或 \`app.vue\`，请确保你初始化了小程序项目，或者在 \`vite.config.ts\` / \`weapp-vite.config.ts\` 中设置正确的 \`weapp.srcRoot\` 配置路径`)
}
