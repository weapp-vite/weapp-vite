import type { CorePluginState, IndependentBuildResult } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
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
    else {
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
