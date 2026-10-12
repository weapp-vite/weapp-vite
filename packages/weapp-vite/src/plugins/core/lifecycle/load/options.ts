import type { LogicalEntryType } from '../../../../moduleGraph/protocol'
import type { AppEntry } from '../../../../types'
import type { ResolveEntryPathOptions } from '../../../../utils/entryResolve'
import type { CorePluginState } from '../../helpers'
import { removeExtension, removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { createLogicalEntryId } from '../../../../moduleGraph/protocol'
import { normalizeSourceId } from '../../../../moduleGraph/traversal'
import { getSelectedAutoRouteSource } from '../../../../runtime/autoRoutesPlugin/selection'
import { prepareIndependentOutputs } from '../../../../runtime/buildPlugin/independentPlan'
import { resolveWeappLibEntries } from '../../../../runtime/lib'
import { findJsEntry, findVueEntry, normalizeAppJson } from '../../../../utils'
import { createCachedEntryResolveOptions, resolveEntryPath } from '../../../../utils/entryResolve'
import { resolveRealpath, withRealpathScope } from '../../../../utils/realpathScope'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { collectImportedVueComponents } from './importedComponents'

interface LogicalInputSource {
  input: string
  source?: string
  type: LogicalEntryType
}

async function collectMainLogicalInputs(state: CorePluginState, appEntry: AppEntry) {
  const { absoluteSrcRoot } = state.ctx.configService
  const appJson = normalizeAppJson(appEntry.json ?? {})
  const inputs: Record<string, LogicalInputSource> = {
    app: {
      input: appEntry.path,
      type: 'app',
    },
  }
  const candidates: Array<{ entry: string, type: LogicalEntryType }> = []
  for (const entry of appJson.pages ?? []) {
    candidates.push({ entry, type: 'page' })
  }
  for (const subPackage of [...appJson.subPackages ?? [], ...appJson.subpackages ?? []]) {
    if (subPackage.independent || typeof subPackage.root !== 'string') {
      continue
    }
    for (const entry of subPackage.pages ?? []) {
      candidates.push({ entry: path.join(subPackage.root, entry), type: 'page' })
    }
  }
  for (const entry of Object.values(appJson.usingComponents ?? {})) {
    if (typeof entry === 'string') {
      candidates.push({ entry, type: 'component' })
    }
  }
  if (appJson.tabBar?.custom) {
    candidates.push({ entry: 'custom-tab-bar/index', type: 'component' })
  }
  if (appJson.appBar) {
    candidates.push({ entry: 'app-bar/index', type: 'component' })
  }

  for (const entry of await collectImportedVueComponents(state, candidates)) {
    candidates.push({ entry, type: 'component' })
  }

  for (const { entry: rawEntry, type } of candidates) {
    if (!rawEntry || rawEntry.includes(':')) {
      continue
    }
    const name = removeExtensionDeep(rawEntry).replace(/^[/\\]+/, '')
    if (!name || inputs[name]) {
      continue
    }
    inputs[name] = {
      input: path.resolve(absoluteSrcRoot, rawEntry.replace(/^[/\\]+/, '')),
      source: rawEntry,
      type,
    }
  }
  return inputs
}

async function resolveLogicalInput(
  pluginContext: any,
  source: LogicalInputSource,
  importer?: string,
  entryResolveOptions?: ResolveEntryPathOptions,
) {
  const resolveSource = async (id: string, sourceImporter?: string) => {
    if (typeof pluginContext?.resolve !== 'function') {
      return undefined
    }
    const resolved = await pluginContext.resolve(id, sourceImporter)
    return resolved?.external ? undefined : resolved?.id
  }
  const resolvePhysicalEntry = async (id: string) => {
    const normalized = normalizeFsResolvedId(id)
    if (path.extname(normalized)) {
      return id
    }
    const localEntry = await resolveEntryPath(normalized, entryResolveOptions)
    if (!localEntry) {
      return undefined
    }
    return await resolveSource(localEntry, importer) ?? localEntry
  }

  // 在宿主的脚本优先 resolver 前补全入口；显式扩展名始终保留。
  const normalizedInput = normalizeFsResolvedId(source.input)
  const physicalInput = path.extname(normalizedInput)
    ? source.input
    : await resolveEntryPath(normalizedInput, entryResolveOptions) ?? source.input
  const primaryId = await resolveSource(physicalInput, importer) ?? physicalInput
  const primaryEntry = await resolvePhysicalEntry(primaryId)
  if (primaryEntry) {
    return primaryEntry
  }
  if (!source.source || typeof pluginContext?.resolve !== 'function') {
    return undefined
  }
  const fallbackId = await resolveSource(source.source, importer)
  return fallbackId ? await resolvePhysicalEntry(fallbackId) : undefined
}

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
  const { scanService, configService } = ctx

  return async function options(this: any, options: any) {
    if (this) {
      ctx.moduleGraphService?.bindPluginContext(state, this)
    }
    state.hmrRootInputIds ??= new Set<string>()
    state.hmrRootInputIds.clear()
    let scannedInput: Record<string, LogicalInputSource>

    if (subPackageMeta) {
      scannedInput = subPackageMeta.entries.reduce<Record<string, LogicalInputSource>>((acc, entry: string) => {
        acc[entry] = {
          input: path.resolve(configService.absoluteSrcRoot, entry),
          type: 'page',
        }
        return acc
      }, {})
    }
    else if (configService.weappLibConfig?.enabled) {
      const libState = ctx.runtimeState.lib
      const entries = await resolveWeappLibEntries(configService, configService.weappLibConfig)
      const outputMap = new Map<string, string>()
      libState.entries.clear()

      scannedInput = entries.reduce<Record<string, LogicalInputSource>>((acc, entry) => {
        acc[entry.name] = {
          input: entry.input,
          type: 'component',
        }
        outputMap.set(entry.relativeBase, entry.outputBase)
        const normalized = normalizeFsResolvedId(entry.input)
        if (normalized) {
          libState.entries.set(normalized, entry)
          libState.entries.set(normalizeFsResolvedId(resolveRealpath(normalized)), entry)
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
        scannedInput = Object.fromEntries(
          Object.entries(await resolvePluginOnlyInput(state)).map(([name, input]) => [name, {
            input,
            type: 'app' as const,
          }]),
        )
      }
      else {
        if (state.resolvedConfig?.build.watch && !configService.isDev) {
          scanService.loadSubPackages()
        }
        else {
          await prepareIndependentOutputs(ctx)
        }
        scannedInput = await collectMainLogicalInputs(state, appEntry)
      }
    }

    const logicalInput: Record<string, string> = {}
    for (const [name, source] of Object.entries(scannedInput)) {
      const selected = source.type === 'page' ? getSelectedAutoRouteSource(ctx, source.input) : undefined
      const sourceId = await resolveLogicalInput(
        this,
        selected ? { ...source, input: selected } : source,
        state.ctx.scanService.appEntry?.path,
        createCachedEntryResolveOptions(configService, { kind: 'default' }),
      )
      if (!sourceId) {
        continue
      }
      // 仅复用 resolver 返回后的同步登记，不跨入口或异步解析保留文件身份。
      withRealpathScope(() => {
        // 生产 watch 的页面拓扑由每轮 buildStart 注册，静态 input 只保留真实 app 入口。
        const dynamicWatchEntry = Boolean(state.resolvedConfig?.build.watch && !configService.isDev && source.type !== 'app' && !configService.weappLibConfig?.enabled)
        const normalized = normalizeFsResolvedId(sourceId)
        if (!dynamicWatchEntry) {
          // 组件脚本与附属资源共用物理输出路径，目录声明解析后不能沿用目录别名。
          const outputName = source.type === 'component' && !configService.weappLibConfig?.enabled
            ? removeExtension(configService.relativeOutputPath(normalized))
            : name
          logicalInput[outputName] = createLogicalEntryId(sourceId, source.type)
        }
        if (normalized) {
          if (!dynamicWatchEntry) {
            state.hmrRootInputIds.add(normalizeSourceId(normalized))
          }
          if (source.type !== 'app' && state.entriesMap) {
            const relativeBase = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(normalized))
            state.entriesMap.set(relativeBase, {
              path: normalized,
              type: source.type === 'page' ? 'page' : 'component',
            } as any)
          }
        }
      })
    }
    options.input = logicalInput
  }
}
