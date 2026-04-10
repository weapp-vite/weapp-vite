import type { CorePluginState, IndependentBuildResult } from '../../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { resolveWeappLibEntries } from '../../../../runtime/lib'
import { findJsEntry, findVueEntry } from '../../../../utils'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'

async function resolvePluginOnlyInput(state: CorePluginState) {
  const { scanService } = state.ctx
  const pluginJson = scanService.pluginJson
  const pluginJsonPath = scanService.pluginJsonPath
  const pluginMain = typeof pluginJson?.main === 'string' ? pluginJson.main.trim() : ''
  if (!pluginJsonPath || !pluginMain) {
    throw new Error('插件独立构建需要在 plugin.json 中声明有效的 main 入口。')
  }

  const pluginEntryBase = path.resolve(path.dirname(pluginJsonPath), removeExtensionDeep(pluginMain))
  const { path: pluginEntryPath } = await findJsEntry(pluginEntryBase)
  const pluginVueEntryPath = pluginEntryPath ? undefined : await findVueEntry(pluginEntryBase)
  const resolvedPath = pluginEntryPath ?? pluginVueEntryPath

  if (!resolvedPath) {
    throw new Error(`未找到插件主入口 ${pluginMain} 对应的脚本文件。`)
  }

  return {
    [removeExtensionDeep(pluginMain)]: resolvedPath,
  }
}

export function createOptionsHook(state: CorePluginState) {
  const { ctx, subPackageMeta } = state
  const { scanService, configService, buildService } = ctx

  return async function options(options: any) {
    state.pendingIndependentBuilds = []
    let scannedInput: Record<string, string>

    if (subPackageMeta) {
      scannedInput = subPackageMeta.entries.reduce<Record<string, string>>((acc, entry: string) => {
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
      if (configService.pluginOnly) {
        scannedInput = await resolvePluginOnlyInput(state)
      }
      else {
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
          const buildTask = buildService.buildIndependentBundle(root, meta).then((rollup: any) => {
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
    }

    options.input = scannedInput
  }
}
