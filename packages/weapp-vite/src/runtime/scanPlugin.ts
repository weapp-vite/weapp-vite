import type { App as AppJson, Plugin as PluginJson, Sitemap as SitemapJson, Theme as ThemeJson } from '@weapp-core/schematics'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { AppEntry, SubPackage, SubPackageMetaValue } from '../types'
import { isObject, removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { collectPluginExportEntries } from '../plugins/utils/analyze'
import { findJsEntry, findJsonEntry } from '../utils'

export interface ScanService {
  appEntry?: AppEntry
  pluginJson?: PluginJson
  subPackageMap: Map<string, SubPackageMetaValue>
  independentSubPackageMap: Map<string, SubPackageMetaValue>
  loadAppEntry: () => Promise<AppEntry>
  loadSubPackages: () => SubPackageMetaValue[]
  isMainPackageFileName: (fileName: string) => boolean
  readonly workersOptions: AppJson['workers'] | undefined
  readonly workersDir: string | undefined
}

function createScanService(ctx: MutableCompilerContext): ScanService {
  const scanState = ctx.runtimeState.scan
  const { subPackageMap, independentSubPackageMap } = scanState

  async function loadAppEntry() {
    if (!ctx.configService || !ctx.jsonService) {
      throw new Error('configService/jsonService must be initialized before scanning entries')
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

    const metas: SubPackageMetaValue[] = []
    const json = scanState.appEntry?.json
    if (json) {
      const independentSubPackages = [
        ...json.subPackages ?? [],
        ...json.subpackages ?? [],
      ] as SubPackage[]
      for (const subPackage of independentSubPackages) {
        const entries: string[] = []

        entries.push(...(subPackage.pages ?? []).map(x => `${subPackage.root}/${x}`))
        if (subPackage.entry) {
          entries.push(`${subPackage.root}/${removeExtensionDeep(subPackage.entry)}`)
        }
        entries.push(...collectPluginExportEntries((subPackage as any).plugins, subPackage.root))
        const meta: SubPackageMetaValue = {
          subPackage,
          entries,
        }
        const subPackageConfig = ctx.configService.weappViteConfig?.subPackages?.[subPackage.root!]
        meta.subPackage.dependencies = subPackageConfig?.dependencies
        meta.subPackage.inlineConfig = subPackageConfig?.inlineConfig
        metas.push(meta)
        subPackageMap.set(subPackage.root!, meta)
        if (subPackage.independent) {
          independentSubPackageMap.set(subPackage.root!, meta)
        }
      }

      return metas
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
  }
}

export function createScanServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createScanService(ctx)
  ctx.scanService = service

  return {
    name: 'weapp-runtime:scan-service',
    async buildStart() {
      service.subPackageMap.clear()
      service.independentSubPackageMap.clear()
      ctx.runtimeState.scan.appEntry = undefined
      ctx.runtimeState.scan.pluginJson = undefined
      await service.loadAppEntry()
      service.loadSubPackages()
    },
  }
}
