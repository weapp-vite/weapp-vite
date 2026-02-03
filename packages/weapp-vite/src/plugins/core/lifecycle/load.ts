import type { CorePluginState, IndependentBuildResult } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { resolveWeappLibEntries } from '../../../runtime/lib'
import { isCSSRequest } from '../../../utils'
import { normalizeWatchPath } from '../../../utils/path'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { readFile as readFileCached } from '../../utils/cache'
import { getCssRealPath, parseRequest } from '../../utils/parse'

export function createOptionsHook(state: CorePluginState) {
  const { ctx, subPackageMeta } = state
  const { scanService, configService, buildService } = ctx

  return async function options(options: any) {
    state.pendingIndependentBuilds = []
    let scannedInput: Record<string, string>

    if (subPackageMeta) {
      scannedInput = subPackageMeta.entries.reduce<Record<string, string>>((acc, entry) => {
        acc[entry] = path.resolve(configService.absoluteSrcRoot, entry)
        return acc
      }, {})
    }
    else if (configService.weappLibConfig?.enabled) {
      const libState = ctx.runtimeState.lib
      const entries = await resolveWeappLibEntries(configService, configService.weappLibConfig)
      const outputMap = new Map<string, string>()
      libState.entries.clear()

      scannedInput = entries.reduce<Record<string, string>>((acc, entry) => {
        acc[entry.name] = entry.input
        outputMap.set(entry.relativeBase, entry.outputBase)
        const normalized = normalizeFsResolvedId(entry.input)
        if (normalized) {
          libState.entries.set(normalized, entry)
        }
        return acc
      }, {})

      libState.enabled = true
      configService.options = {
        ...configService.options,
        weappLibOutputMap: outputMap,
      }
    }
    else {
      const libState = ctx.runtimeState.lib
      libState.enabled = false
      libState.entries.clear()
      if (configService.options.weappLibOutputMap) {
        configService.options = {
          ...configService.options,
          weappLibOutputMap: undefined,
        }
      }
      const appEntry = await scanService.loadAppEntry()
      scanService.loadSubPackages()
      const dirtyIndependentRoots = scanService.drainIndependentDirtyRoots()
      const pendingIndependentBuilds: Promise<IndependentBuildResult>[] = []
      // Serialize prod builds to avoid shared runtime state races.
      const shouldSerializeIndependentBuilds = !configService.isDev && dirtyIndependentRoots.length > 0
      const previousSubPackageRoot = shouldSerializeIndependentBuilds
        ? configService.currentSubPackageRoot
        : undefined
      for (const root of dirtyIndependentRoots) {
        const meta = scanService.independentSubPackageMap.get(root)
        if (!meta) {
          continue
        }
        const buildTask = buildService.buildIndependentBundle(root, meta).then((rollup) => {
          return {
            meta,
            rollup,
          }
        })
        buildTask.catch(() => {})
        pendingIndependentBuilds.push(buildTask)
        if (shouldSerializeIndependentBuilds) {
          try {
            await buildTask
          }
          catch {}
        }
      }
      if (shouldSerializeIndependentBuilds && configService.currentSubPackageRoot !== previousSubPackageRoot) {
        configService.options = {
          ...configService.options,
          currentSubPackageRoot: previousSubPackageRoot,
        }
      }
      state.pendingIndependentBuilds = pendingIndependentBuilds
      scannedInput = { app: appEntry.path }
    }

    options.input = scannedInput
  }
}

export function createLoadHook(state: CorePluginState) {
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet } = state
  const { configService } = ctx

  return async function load(this: any, id: string) {
    configService.weappViteConfig?.debug?.load?.(id, subPackageMeta)

    if (isCSSRequest(id)) {
      const parsed = parseRequest(id)
      if (parsed.query.wxss) {
        const realPath = getCssRealPath(parsed)
        this.addWatchFile(normalizeWatchPath(realPath))
        try {
          const css = await readFileCached(realPath, { checkMtime: configService.isDev })
          return { code: css }
        }
        catch {}
      }
      return null
    }

    const sourceId = normalizeFsResolvedId(id)
    const libEntry = configService.weappLibConfig?.enabled
      ? ctx.runtimeState.lib.entries.get(sourceId)
      : undefined
    if (libEntry) {
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      return await loadEntry.call(this, sourceId, 'component')
    }
    const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(sourceId))

    if (relativeBasename === 'app') {
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      return await loadEntry.call(this, sourceId, 'app')
    }

    if (loadedEntrySet.has(sourceId) || subPackageMeta?.entries.includes(relativeBasename)) {
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      return await loadEntry.call(this, sourceId, 'component')
    }
  }
}
