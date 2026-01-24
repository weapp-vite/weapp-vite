import type { ChangeEvent, SubPackageMetaValue } from '../../../types'
import type { CorePluginState } from '../helpers'
import path from 'pathe'
import { configExtensions, supportedCssLangs } from '../../../constants'
import logger from '../../../logger'
import { DEFAULT_MP_PLATFORM } from '../../../platform'
import { resetTakeImportRegistry } from '../../../runtime/chunkStrategy'
import { findJsEntry, isTemplate } from '../../../utils/file'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { invalidateSharedStyleCache } from '../../css/shared/preprocessor'
import { invalidateFileCache } from '../../utils/cache'
import { ensureSidecarWatcher, invalidateEntryForSidecar } from '../../utils/invalidateEntry'
import { collectAffectedEntries } from '../helpers'

const configSuffixes = configExtensions.map(ext => `.${ext}`)
const styleSuffixes = supportedCssLangs.map(ext => `.${ext}`)

export function createBuildStartHook(state: CorePluginState) {
  const { ctx, subPackageMeta, emitDirtyEntries, buildTarget } = state
  const { configService } = ctx
  const isPluginBuild = buildTarget === 'plugin'

  return async function buildStart(this: any) {
    resetTakeImportRegistry()
    if (configService.isDev) {
      if (isPluginBuild) {
        if (configService.absolutePluginRoot) {
          ensureSidecarWatcher(ctx, configService.absolutePluginRoot)
        }
      }
      else {
        const rootDir = subPackageMeta
          ? path.resolve(configService.absoluteSrcRoot, subPackageMeta.subPackage.root)
          : configService.absoluteSrcRoot
        ensureSidecarWatcher(ctx, rootDir)
        if (!subPackageMeta && configService.absolutePluginRoot) {
          ensureSidecarWatcher(ctx, configService.absolutePluginRoot)
        }
      }
    }
    await emitDirtyEntries.call(this)
  }
}

export function createWatchChangeHook(state: CorePluginState) {
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet, markEntryDirty } = state
  const { scanService, configService, buildService } = ctx

  return async function watchChange(id: string, change: { event: ChangeEvent }) {
    const normalizedId = normalizeFsResolvedId(id)
    if (isSkippableResolvedId(normalizedId)) {
      return
    }
    invalidateFileCache(normalizedId)
    if (change.event === 'update') {
      const isTemplateFile = isTemplate(normalizedId)
      const configSuffix = configSuffixes.find(suffix => normalizedId.endsWith(suffix))
      const isStyleFile = styleSuffixes.some(suffix => normalizedId.endsWith(suffix))

      if (isTemplateFile) {
        const wxmlService = ctx.wxmlService
        if (wxmlService) {
          await wxmlService.scan(normalizedId)
        }
      }

      if (isTemplateFile || configSuffix || isStyleFile) {
        const basePath = configSuffix
          ? normalizedId.slice(0, -configSuffix.length)
          : (() => {
              const ext = path.extname(normalizedId)
              return ext ? normalizedId.slice(0, -ext.length) : normalizedId
            })()
        const primaryScript = await findJsEntry(basePath)
        if (primaryScript.path) {
          markEntryDirty(normalizeFsResolvedId(primaryScript.path))
        }
      }
    }
    if (loadedEntrySet.has(normalizedId)) {
      markEntryDirty(normalizedId)
    }
    else if (state.moduleImporters.size && state.entryModuleIds.size) {
      const affected = collectAffectedEntries(state, normalizedId)
      if (affected.size) {
        for (const entryId of affected) {
          markEntryDirty(entryId)
        }
      }
    }
    const relativeSrc = configService.relativeAbsoluteSrcRoot(normalizedId)
    const relativeCwd = configService.relativeCwd(normalizedId)
    let handledByIndependentWatcher = false
    let independentMeta: SubPackageMetaValue | undefined

    if (change.event === 'create' || change.event === 'delete') {
      ;(loadEntry as any)?.invalidateResolveCache?.()
      await invalidateEntryForSidecar(ctx, normalizedId, change.event)
    }

    if (!subPackageMeta) {
      const multiPlatformConfig = configService.weappViteConfig?.multiPlatform
      const isMultiPlatformEnabled = Boolean(
        multiPlatformConfig
        && (typeof multiPlatformConfig !== 'object' || multiPlatformConfig.enabled !== false),
      )
      let shouldMarkProjectConfigDirty = relativeCwd === 'project.config.json' || relativeCwd === 'project.private.config.json'
      if (isMultiPlatformEnabled) {
        const projectConfigRoot = typeof multiPlatformConfig === 'object' && multiPlatformConfig.projectConfigRoot?.trim()
          ? multiPlatformConfig.projectConfigRoot.trim()
          : 'config'
        const platform = configService.platform ?? DEFAULT_MP_PLATFORM
        const platformConfigDir = path.join(projectConfigRoot, platform)
        const platformConfigPrefix = `${platformConfigDir}/`
        shouldMarkProjectConfigDirty = relativeCwd.startsWith(platformConfigPrefix)
      }

      if (relativeSrc === 'app.json' || shouldMarkProjectConfigDirty) {
        scanService.markDirty()
      }

      const independentRoot = Array.from(scanService.independentSubPackageMap.keys()).find((root) => {
        return relativeSrc.startsWith(`${root}/`)
      })

      if (independentRoot) {
        independentMeta = scanService.independentSubPackageMap.get(independentRoot)
        buildService.invalidateIndependentOutput(independentRoot)
        scanService.markIndependentDirty(independentRoot)
        handledByIndependentWatcher = true
        if (independentMeta?.watchSharedStyles !== false) {
          invalidateSharedStyleCache()
        }
      }
    }

    if (subPackageMeta) {
      if (subPackageMeta.watchSharedStyles !== false) {
        invalidateSharedStyleCache()
      }
      logger.success(`[${change.event}] ${configService.relativeCwd(normalizedId)} --[独立分包 ${subPackageMeta.subPackage.root}]`)
    }
    else if (!handledByIndependentWatcher) {
      logger.success(`[${change.event}] ${configService.relativeCwd(normalizedId)}`)
    }
  }
}
