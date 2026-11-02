import type { OutputBundle } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../context'
import type {
  WeappCompilerPluginContext,
  WeappCompilerPluginController,
  WeappCompilerResourceKind,
  WeappCompilerSourceRequest,
} from '../../types/compilerPlugin'
import type { PluginContextRef } from './helpers'
import type { ControllerCleanupMethod, ControllerRecord } from './lifecycle'
import { fs } from '@weapp-core/shared/fs'
import { createLogger } from 'vite'
import { deferWatcherResourceCleanup } from '../../runtime/watcherPlugin'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import {
  addManagedCompilerEntry,
  createManagedCompilerEntryMarker,
  stripManagedCompilerMarkers,
} from '../compilerPluginRegistry'
import { createCompilerDependencyTracker } from './dependencies'
import {
  inferCompilerOutputKind,
  inferCompilerResourceKind,
  markWeappCompilerPlugin,
  normalizeCompilerPluginOptions,

  readCompilerOutputAsset,
} from './helpers'
import { getCompilerHmrHost } from './hmr'
import { collectControllerCleanupErrors, initializeCompilerControllers, throwControllerErrors } from './lifecycle'

export {
  getWeappCompilerPluginMeta,
  isWeappCompilerPlugin,
  markWeappCompilerPlugin,
  WEAPP_COMPILER_PLUGIN_META,
} from './helpers'

interface SourceState {
  provider: string
  entryId: string
  state?: unknown
}

function createContext(ctx: CompilerContext, resolvedConfigRef: { value?: ResolvedConfig }, pluginContextRef: { value?: PluginContextRef }, owners: Map<string, string>, rememberDependency: (id: string) => void): WeappCompilerPluginContext {
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
    addWatchFile(id) {
      rememberDependency(id)
      pluginContextRef.value?.addWatchFile?.(id)
    },
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

export function createCompilerPluginPlugins(ctx: CompilerContext): Plugin[] {
  const options = normalizeCompilerPluginOptions(ctx.configService.weappViteConfig?.compilerPlugins)
  if (!options.length) {
    return []
  }

  const resolvedConfigRef: { value?: ResolvedConfig } = {}
  const pluginContextRef: { value?: PluginContextRef } = {}
  const owners = new Map<string, string>()
  const sourceStates = new Map<string, SourceState>()
  const releaseHmrProviders: Array<() => void> = []
  let recordsPromise: Promise<ControllerRecord[]> | undefined
  let disposePromise: Promise<void> | undefined
  let closeWatcherPromise: Promise<void> | undefined
  let closeBundlePromise: Promise<void> | undefined
  let disposeSettled = false
  let activeCloseHooks = 0
  const dependencyTracker = createCompilerDependencyTracker(ctx)
  const context = createContext(ctx, resolvedConfigRef, pluginContextRef, owners, dependencyTracker.remember)

  const sourceStateKey = (provider: string, id: string) => `${provider}:${normalizeFsResolvedId(id, { stripLeadingNullByte: true })}`

  async function records() {
    recordsPromise ??= initializeCompilerControllers(options, context).then((resolved) => {
      for (const { provider, controller } of resolved) {
        if (provider.capabilities?.content || controller.prepareHmr) {
          releaseHmrProviders.push(getCompilerHmrHost(ctx).register(provider.name, controller.prepareHmr
            ? async (request) => {
              const preparation = await controller.prepareHmr!(request)
              for (const file of preparation.dependencies ?? []) {
                context.addWatchFile(file)
              }
              for (const file of preparation.invalidated ?? []) {
                context.invalidate(file)
              }
              return preparation
            }
            : undefined))
        }
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

  function releaseTerminalContext() {
    if (disposeSettled && activeCloseHooks === 0) {
      resolvedConfigRef.value = undefined
      pluginContextRef.value = undefined
    }
  }

  async function callCloseHook(method: 'closeBundle' | 'closeWatcher') {
    activeCloseHooks++
    try {
      throwControllerErrors(await collectControllerCleanupErrors(await records(), method), `Compiler provider ${method} failed`)
    }
    finally {
      activeCloseHooks--
      releaseTerminalContext()
    }
  }

  function disposeControllers() {
    disposePromise ??= (async () => {
      try {
        throwControllerErrors(await collectControllerCleanupErrors(await records(), 'dispose'), 'Compiler provider disposal failed')
      }
      finally {
        for (const release of releaseHmrProviders.splice(0)) {
          release()
        }
        // 只计原始关闭钩子，避免共享 dispose 与完整 close Promise 相互等待。
        disposeSettled = true
        releaseTerminalContext()
        dependencyTracker.dispose()
      }
    })()
    return disposePromise
  }

  async function closeAndDisposeControllers(method: Exclude<ControllerCleanupMethod, 'dispose'>) {
    const errors: unknown[] = []
    try {
      await callCloseHook(method)
    }
    catch (error) {
      errors.push(error)
    }
    try {
      await disposeControllers()
    }
    catch (error) {
      if (!errors.includes(error)) {
        errors.push(error)
      }
    }
    throwControllerErrors(errors, 'Compiler provider close and disposal failed')
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
    configureServer: dependencyTracker.configureServer,
    configResolved(config) {
      resolvedConfigRef.value = config
      pluginContextRef.value = this as unknown as PluginContextRef
    },
    async buildStart() {
      pluginContextRef.value = this as unknown as PluginContextRef
      sourceStates.clear()
      if (ctx.configService.isDev && resolvedConfigRef.value?.command === 'build' && !resolvedConfigRef.value.build.watch) {
        for (const change of ctx.moduleGraphService?.getPendingChanges?.() ?? []) {
          await callControllers('watchChange', change.file, { event: change.event })
        }
      }
      await callControllers('buildStart')
    },
    async transform(code, id) {
      pluginContextRef.value = this as unknown as PluginContextRef
      return dependencyTracker.trackSource(id, () => transformSource(code, id))
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
    closeWatcher() {
      closeWatcherPromise ??= closeAndDisposeControllers('closeWatcher')
      return closeWatcherPromise
    },
  }, 'source', 'source')

  function closeControllers() {
    closeBundlePromise ??= closeAndDisposeControllers('closeBundle')
    return closeBundlePromise
  }

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
      if (!deferWatcherResourceCleanup(ctx.watcherService, closeControllers)) {
        await closeControllers()
      }
    },
  }, 'output', 'output')

  return [sourcePlugin, outputPlugin]
}
