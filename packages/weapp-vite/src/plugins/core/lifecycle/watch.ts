import type { ChangeEvent, SubPackageMetaValue } from '../../../types'
import type { CorePluginState } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { configExtensions, supportedCssLangs } from '../../../constants'
import logger from '../../../logger'
import { resolveMultiPlatformProjectConfigDir } from '../../../multiPlatform'
import { DEFAULT_MP_PLATFORM } from '../../../platform'
import { resetTakeImportRegistry } from '../../../runtime/chunkStrategy'
import { getProjectConfigFileName, getProjectPrivateConfigFileName } from '../../../utils'
import { findJsEntry, isTemplate } from '../../../utils/file'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { invalidateSharedStyleCache } from '../../css/shared/preprocessor'
import { invalidateFileCache } from '../../utils/cache'
import { ensureSidecarWatcher, invalidateEntryForSidecar } from '../../utils/invalidateEntry'
import { collectAffectedEntries } from '../helpers'

const configSuffixes = configExtensions.map(ext => `.${ext}`)
const styleSuffixes = supportedCssLangs.map(ext => `.${ext}`)
const ATOMIC_SAVE_RECHECK_DELAYS_MS = [20, 60]

function isLayoutSourcePath(relativeSrc: string) {
  return relativeSrc === 'layouts' || relativeSrc.startsWith('layouts/')
}

async function normalizeWatchEvent(id: string, event: ChangeEvent) {
  if (event !== 'delete') {
    return event
  }

  for (const delayMs of ATOMIC_SAVE_RECHECK_DELAYS_MS) {
    if (await fs.pathExists(id)) {
      return 'update' satisfies ChangeEvent
    }
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  return await fs.pathExists(id) ? 'update' : event
}

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

async function processChangedFile(
  state: CorePluginState,
  id: string,
  event: ChangeEvent,
) {
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet, markEntryDirty, resolvedEntryMap } = state
  const { scanService, configService, buildService } = ctx
  const normalizedId = normalizeFsResolvedId(id)
  if (isSkippableResolvedId(normalizedId)) {
    return
  }
  const relativeSrc = configService.relativeAbsoluteSrcRoot(normalizedId)
  const affectedLayoutEntryIds = new Set<string>()
  const declaredEntryType = state.entriesMap.get(removeExtensionDeep(relativeSrc))?.type
  const isDeletedMissingSelf = event === 'delete' && !await fs.pathExists(normalizedId)
  invalidateFileCache(normalizedId)
  if (event === 'update') {
    const isTemplateFile = isTemplate(normalizedId)
    const configSuffix = configSuffixes.find(suffix => normalizedId.endsWith(suffix))
    const isStyleFile = styleSuffixes.some(suffix => normalizedId.endsWith(suffix))

    if (isTemplateFile) {
      const wxmlService = ctx.wxmlService
      if (wxmlService) {
        await wxmlService.scan(normalizedId)
      }
    }

    const isHtmlTemplateFile = normalizedId.endsWith('.html')

    if (isTemplateFile || configSuffix || isStyleFile || isHtmlTemplateFile) {
      const basePath = configSuffix
        ? normalizedId.slice(0, -configSuffix.length)
        : (() => {
            const ext = path.extname(normalizedId)
            return ext ? normalizedId.slice(0, -ext.length) : normalizedId
          })()
      const primaryScript = await findJsEntry(basePath)
      if (primaryScript.path) {
        const primaryScriptId = normalizeFsResolvedId(primaryScript.path)
        const reason = isLayoutSourcePath(configService.relativeAbsoluteSrcRoot(primaryScriptId))
          ? 'dependency'
          : 'direct'
        if (reason === 'dependency') {
          affectedLayoutEntryIds.add(primaryScriptId)
        }
        else {
          markEntryDirty(primaryScriptId, reason)
        }
      }
    }
  }

  if (
    event === 'update'
    && isLayoutSourcePath(relativeSrc)
    && (loadedEntrySet.has(normalizedId) || resolvedEntryMap.has(normalizedId))
  ) {
    affectedLayoutEntryIds.add(normalizedId)
  }

  if (event === 'update' && affectedLayoutEntryIds.size) {
    if (!resolvedEntryMap.size) {
      for (const entryId of affectedLayoutEntryIds) {
        markEntryDirty(entryId, 'dependency')
      }
      return
    }

    const dependentEntryIds = new Set<string>()

    for (const layoutEntryId of affectedLayoutEntryIds) {
      const dependents = state.layoutEntryDependents.get(layoutEntryId)
      if (!dependents?.size) {
        continue
      }
      for (const entryId of dependents) {
        dependentEntryIds.add(entryId)
      }
    }

    if (dependentEntryIds.size) {
      for (const entryId of affectedLayoutEntryIds) {
        markEntryDirty(entryId, 'dependency')
      }
      for (const entryId of dependentEntryIds) {
        markEntryDirty(entryId, 'dependency')
      }
      return
    }

    for (const entryId of resolvedEntryMap.keys()) {
      markEntryDirty(entryId, 'dependency')
    }
    return
  }

  if (!isDeletedMissingSelf && (loadedEntrySet.has(normalizedId) || declaredEntryType === 'page' || declaredEntryType === 'component')) {
    markEntryDirty(normalizedId, 'direct')
  }
  else if (state.layoutEntryDependents.size && state.layoutEntryDependents.get(normalizedId)?.size) {
    const affectedEntries = state.layoutEntryDependents.get(normalizedId)
    for (const entryId of affectedEntries!) {
      markEntryDirty(entryId, 'dependency')
    }
  }
  else if (state.moduleImporters.size && state.entryModuleIds.size) {
    const affected = collectAffectedEntries(state, normalizedId)
    if (affected.size) {
      for (const entryId of affected) {
        markEntryDirty(entryId, 'dependency')
      }
    }
  }
  const relativeCwd = configService.relativeCwd(normalizedId)
  let handledByIndependentWatcher = false
  let independentMeta: SubPackageMetaValue | undefined

  if (event === 'create' || event === 'delete') {
    ;(loadEntry as any)?.invalidateResolveCache?.()
    await invalidateEntryForSidecar(ctx, normalizedId, event)
  }

  if (!subPackageMeta && !configService.weappLibConfig?.enabled) {
    const isMultiPlatformEnabled = configService.multiPlatform.enabled
    const platform = configService.platform ?? DEFAULT_MP_PLATFORM
    const projectConfigFileName = getProjectConfigFileName(platform)
    const projectPrivateConfigFileName = getProjectPrivateConfigFileName(platform)
    let shouldMarkProjectConfigDirty = relativeCwd === projectConfigFileName || relativeCwd === projectPrivateConfigFileName
    if (isMultiPlatformEnabled) {
      const platformConfigDir = resolveMultiPlatformProjectConfigDir(configService.multiPlatform, platform)
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
    logger.success(`[${event}] ${configService.relativeCwd(normalizedId)} --[独立分包 ${subPackageMeta.subPackage.root}]`)
  }
  else if (!handledByIndependentWatcher) {
    logger.success(`[${event}] ${configService.relativeCwd(normalizedId)}`)
  }
}

export function createWatchChangeHook(state: CorePluginState) {
  return async function watchChange(id: string, change: { event: ChangeEvent }) {
    const startedAt = performance.now()
    const normalizedId = normalizeFsResolvedId(id)
    if (isSkippableResolvedId(normalizedId)) {
      return
    }
    const event = await normalizeWatchEvent(normalizedId, change.event)
    await processChangedFile(state, normalizedId, event)
    state.ctx.runtimeState.build.hmr.profile = {
      ...state.ctx.runtimeState.build.hmr.profile,
      event,
      file: normalizedId,
      watchToDirtyMs: performance.now() - startedAt,
    }
  }
}
