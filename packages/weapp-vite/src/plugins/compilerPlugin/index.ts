import type { OutputBundle } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../context'
import type {
  WeappCompilerPlugin,
  WeappCompilerPluginContext,
  WeappCompilerPluginController,
  WeappCompilerPluginFactory,
  WeappCompilerPluginOption,
  WeappCompilerResourceKind,
  WeappCompilerSourceRequest,
} from '../../types/compilerPlugin'
import type { PluginContextRef } from './helpers'
import { fs } from '@weapp-core/shared/fs'
import { createLogger } from 'vite'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import {
  addManagedCompilerEntry,
  createManagedCompilerEntryMarker,
  stripManagedCompilerMarkers,
} from '../compilerPluginRegistry'
import {
  inferCompilerOutputKind,
  inferCompilerResourceKind,
  markWeappCompilerPlugin,
  normalizeCompilerPluginOptions,

  readCompilerOutputAsset,
} from './helpers'

export {
  getWeappCompilerPluginMeta,
  isWeappCompilerPlugin,
  markWeappCompilerPlugin,
  WEAPP_COMPILER_PLUGIN_META,
} from './helpers'

interface ControllerRecord {
  provider: WeappCompilerPlugin
  controller: WeappCompilerPluginController
}

interface SourceState {
  provider: string
  entryId: string
  state?: unknown
}

function createContext(ctx: CompilerContext, resolvedConfigRef: { value?: ResolvedConfig }, pluginContextRef: { value?: PluginContextRef }, owners: Map<string, string>): WeappCompilerPluginContext {
  const logger = createLogger('warn')
  const normalizeOwnerId = (id: string) => normalizeFsResolvedId(id, { stripLeadingNullByte: true })
  return {
    root: ctx.configService.cwd,
    srcRoot: ctx.configService.absoluteSrcRoot,
    platform: ctx.configService.platform,
    outputExtensions: ctx.configService.outputExtensions,
    isDev: ctx.configService.isDev,
    get resolvedConfig() {
      return resolvedConfigRef.value
    },
    readFile: id => fs.readFile(id, 'utf8'),
    resolve: async (source, importer, options) => {
      const resolver = pluginContextRef.value?.resolve
      if (typeof resolver !== 'function') {
        return null
      }
      const resolved = await resolver.call(pluginContextRef.value, source, importer, options)
      return resolved && !resolved.external ? { id: resolved.id } : null
    },
    addWatchFile: id => pluginContextRef.value?.addWatchFile?.(id),
    invalidate: (id) => {
      const moduleGraph = pluginContextRef.value?.environment?.moduleGraph
      const module = moduleGraph?.getModuleById?.(id)
      const invalidateModule = moduleGraph?.invalidateModule
      if (module && moduleGraph && invalidateModule) {
        invalidateModule.call(moduleGraph, module)
      }
    },
    warn: message => logger.warn(`[weapp-vite:compiler] ${message}`),
    error: (message) => {
      throw new Error(message)
    },
    claimSource: (id, owner) => {
      const normalizedId = normalizeOwnerId(id)
      const existing = owners.get(normalizedId)
      if (existing && existing !== owner) {
        throw new Error(`编译插件源码所有权冲突：\`${id}\` 已由 \`${existing}\` 接管，无法再由 \`${owner}\` 接管。`)
      }
      owners.set(normalizedId, owner)
      addManagedCompilerEntry(ctx, owner, normalizedId)
    },
    getSourceOwner: id => owners.get(normalizeOwnerId(id)),
  }
}

function createProvider(option: WeappCompilerPluginOption, context: WeappCompilerPluginContext): WeappCompilerPlugin | Promise<WeappCompilerPlugin> {
  return typeof option === 'function'
    ? (option as WeappCompilerPluginFactory)(context)
    : option
}

export function createCompilerPluginPlugins(ctx: CompilerContext): Plugin[] {
  const options = normalizeCompilerPluginOptions(ctx.configService.weappViteConfig?.compilerPlugins)
  if (!options.length) {
    return []
  }

  const resolvedConfigRef: { value?: ResolvedConfig } = {}
  const pluginContextRef: { value?: PluginContextRef } = {}
  const owners = new Map<string, string>()
  const sourceStates = new Map<string, SourceState>()
  let recordsPromise: Promise<ControllerRecord[]> | undefined
  let disposed = false
  let closeWatcherCalled = false
  let closeBundleCalled = false
  const context = createContext(ctx, resolvedConfigRef, pluginContextRef, owners)

  const sourceStateKey = (provider: string, id: string) => `${provider}:${normalizeFsResolvedId(id, { stripLeadingNullByte: true })}`

  async function records() {
    recordsPromise ??= Promise.all(options.map(async (option) => {
      const provider = await createProvider(option, context)
      const controller = await provider.create(context)
      return { provider, controller }
    })).then((resolved) => {
      const names = new Set<string>()
      for (const { provider } of resolved) {
        if (names.has(provider.name)) {
          throw new Error(`编译插件名称重复：\`${provider.name}\`。请为每个 compiler provider 使用唯一名称。`)
        }
        names.add(provider.name)
      }
      return resolved
    })
    return recordsPromise
  }

  async function callControllers(method: keyof WeappCompilerPluginController, ...args: any[]) {
    for (const { controller } of await records()) {
      const handler = controller[method]
      if (typeof handler === 'function') {
        await (handler as (...items: any[]) => unknown).apply(controller, args)
      }
    }
  }

  async function disposeControllers() {
    if (disposed) {
      return
    }
    disposed = true
    await callControllers('dispose')
  }

  function setSourceState(provider: string, ids: string[], state: SourceState) {
    for (const id of ids) {
      sourceStates.set(sourceStateKey(provider, id), state)
    }
  }

  async function transformSource(code: string, id: string) {
    const kind = inferCompilerResourceKind(id, ctx.configService.outputExtensions)
    if (!kind) {
      return null
    }
    const request: WeappCompilerSourceRequest = { code, id, kind }
    let current = code
    let map: unknown
    let changed = false
    for (const { provider, controller } of await records()) {
      const claim = await controller.claimSource?.(request)
      if (!claim) {
        continue
      }
      const claimId = typeof claim === 'object' && claim.id ? claim.id : id
      const claimEntryId = typeof claim === 'object' && claim.entryId ? claim.entryId : claimId
      context.claimSource(claimId, provider.name)
      // Preserve the claim's entry identity even when the provider intentionally
      // leaves source code unchanged or does not expose transformSource.
      setSourceState(provider.name, [id, claimId, claimEntryId], {
        provider: provider.name,
        entryId: claimEntryId,
      })
      for (const dependency of typeof claim === 'object' ? claim.dependencies ?? [] : []) {
        context.addWatchFile(dependency)
      }
      const result = await controller.transformSource?.({ ...request, code: stripManagedCompilerMarkers(current) })
      if (kind === 'style' && !current.includes(createManagedCompilerEntryMarker())) {
        current = `${current}\n${createManagedCompilerEntryMarker()}`
        changed = true
      }
      if (!result) {
        continue
      }
      current = result.code
      if (kind === 'style' && !current.includes(createManagedCompilerEntryMarker())) {
        current = `${current}\n${createManagedCompilerEntryMarker()}`
      }
      map = result.map
      changed ||= result.code !== code || result.map !== undefined || result.handled === true
      const resultEntryId = result.entryId ?? claimEntryId
      const sourceState = { provider: provider.name, entryId: resultEntryId, state: result.state }
      setSourceState(provider.name, [id, claimId, claimEntryId, resultEntryId], sourceState)
      for (const dependency of result.dependencies ?? []) {
        context.addWatchFile(dependency)
      }
      for (const invalidated of result.invalidated ?? []) {
        context.invalidate(invalidated)
      }
    }
    return changed ? { code: current, map: map as any } : null
  }

  async function transformOutput(kind: WeappCompilerResourceKind, fileName: string, code: string) {
    let current = kind === 'style' ? stripManagedCompilerMarkers(code) : code
    let map: unknown
    let changed = current !== code
    for (const { provider, controller } of await records()) {
      const method = kind === 'style' ? controller.transformCss : kind === 'template' ? controller.transformTemplate : controller.transformJavaScript
      if (!method) {
        continue
      }
      const sourceState = sourceStates.get(sourceStateKey(provider.name, fileName))
      const result = await method.call(controller, {
        fileName,
        code: current,
        entryId: sourceState?.entryId ?? fileName,
        state: sourceState?.state,
      })
      if (!result) {
        continue
      }
      current = stripManagedCompilerMarkers(result.code)
      map = result.map
      changed ||= result.code !== code || result.map !== undefined || result.handled === true
      for (const dependency of result.dependencies ?? []) {
        context.addWatchFile(dependency)
      }
      for (const invalidated of result.invalidated ?? []) {
        context.invalidate(invalidated)
      }
    }
    return changed ? { code: current, map: map as any } : null
  }

  const sourcePlugin = markWeappCompilerPlugin({
    name: 'weapp-vite:compiler:source',
    enforce: 'pre',
    configResolved(config) {
      resolvedConfigRef.value = config
      pluginContextRef.value = this as unknown as PluginContextRef
    },
    async buildStart() {
      pluginContextRef.value = this as unknown as PluginContextRef
      sourceStates.clear()
      await callControllers('buildStart')
    },
    async transform(code, id) {
      pluginContextRef.value = this as unknown as PluginContextRef
      return transformSource(code, id)
    },
    async watchChange(id, change) {
      await callControllers('watchChange', id, change)
    },
    async handleHotUpdate({ file }) {
      for (const { controller } of await records()) {
        const invalidated = await controller.handleHotUpdate?.(file)
        for (const id of invalidated ?? []) {
          context.invalidate(id)
        }
      }
    },
    async buildEnd(error) {
      await callControllers('buildEnd', error)
    },
    async closeWatcher() {
      if (closeWatcherCalled) {
        return
      }
      closeWatcherCalled = true
      try {
        await callControllers('closeWatcher')
      }
      finally {
        await disposeControllers()
      }
    },
  }, 'source', 'source')

  const outputPlugin = markWeappCompilerPlugin({
    name: 'weapp-vite:compiler:output',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        pluginContextRef.value = this as unknown as PluginContextRef
        const outputBundle = bundle as unknown as OutputBundle
        for (const { controller } of await records()) {
          await controller.generateBundle?.(outputBundle, context)
        }
        for (const output of Object.values(outputBundle)) {
          const kind = inferCompilerOutputKind(output.fileName, ctx.configService.outputExtensions)
          if (!kind) {
            continue
          }
          if (output.type === 'asset') {
            const source = readCompilerOutputAsset(output)
            const result = await transformOutput(kind, output.fileName, source)
            if (result) {
              output.source = result.code
            }
          }
          else if (kind === 'script') {
            const result = await transformOutput(kind, output.fileName, output.code)
            if (result) {
              output.code = result.code
              if (result.map) {
                output.map = result.map as any
              }
            }
          }
        }
      },
    },
    async closeBundle() {
      if (closeBundleCalled) {
        return
      }
      closeBundleCalled = true
      try {
        await callControllers('closeBundle')
      }
      finally {
        await disposeControllers()
      }
    },
  }, 'output', 'output')

  return [sourcePlugin, outputPlugin]
}
