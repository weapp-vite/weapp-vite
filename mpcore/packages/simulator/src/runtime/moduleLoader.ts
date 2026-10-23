import type {
  HeadlessAppDefinition,
  HeadlessBehaviorDefinition,
  HeadlessComponentDefinition,
  HeadlessHostLoadContext,
  HeadlessHostRegistries,
  HeadlessPageDefinition,
  HeadlessWx,
} from '../host'
import type { HeadlessWorkerApis } from '../host/wx/workers'
import type { ArtifactSource, RuntimeKernel } from '../kernel'
import type { HeadlessPluginDescriptor } from '../project'
import path from 'node:path'
import vm from 'node:vm'
import { normalize } from 'pathe'
import {
  createHeadlessWx,
  normalizeComponentPageDefinition,
  registerAppDefinition,
  registerComponentDefinition,
  registerExportedComponentDefinition,
  registerPageDefinition,
} from '../host'
import { createWorkerHost } from '../runtime/workerHost'
import { resolveMiniProgramModule } from './moduleResolution'
import { transformMiniProgramModule } from './moduleSyntax'
import { reloadPageModuleDefinition } from './pageDefinitionReload'
import { createMiniProgramRuntimeGlobals } from './runtimeGlobals'
import { closeRuntimeWxsLoader } from './wxs'

export interface HeadlessModuleLoader {
  close: () => void
  evaluate: <T>(source: string, args: any[]) => T
  executeComponentModule: (filePath: string, id: string) => HeadlessComponentDefinition
  executeAppModule: (filePath: string) => HeadlessAppDefinition
  executePageModule: (filePath: string, route: string) => HeadlessPageDefinition
  reloadPageModule: (filePath: string, route: string) => boolean
  wx: HeadlessWx
}

interface ModuleCacheEntry {
  source: string
  componentDefinitions: HeadlessComponentDefinition[]
  exports: Record<string, any>
}

interface LocalRequire {
  (request: string): any
  async: (request: string) => Promise<any>
}

function createRequireNotFoundError(request: string, importer: string) {
  return new Error(`Cannot resolve require("${request}") from ${normalize(importer)} in headless runtime.`)
}

function createExecutionContext(
  registries: HeadlessHostRegistries,
  getCurrentPages: () => any[],
  getApp: () => any,
  wxDriver: Parameters<typeof createHeadlessWx>[0],
  kernel: RuntimeKernel,
  globals: Record<string, unknown>,
  onConsole?: (entry: import('../kernel').RuntimeConsoleEntry) => void,
  workers?: HeadlessWorkerApis,
) {
  const runtimeConsole = kernel.diagnostics.createConsole(console, onConsole)
  const wx = createHeadlessWx(wxDriver, runtimeConsole, workers)

  return createMiniProgramRuntimeGlobals({
    App(definition: HeadlessAppDefinition) {
      return registerAppDefinition(registries, definition)
    },
    Behavior(definition: HeadlessBehaviorDefinition) {
      return {
        ...definition,
        __isHeadlessBehavior__: true,
      }
    },
    Component(definition: HeadlessComponentDefinition) {
      return registerComponentDefinition(registries, definition)
    },
    Page(definition: HeadlessPageDefinition) {
      return registerPageDefinition(registries, definition)
    },
    console: runtimeConsole,
    clearInterval: (handle: ReturnType<typeof setInterval>) => kernel.scheduler.clearInterval(handle),
    clearTimeout: (handle: ReturnType<typeof setTimeout>) => kernel.scheduler.clearTimeout(handle),
    getApp,
    getCurrentPages,
    globalThis: undefined as any,
    require: undefined as any,
    setInterval: kernel.scheduler.setInterval.bind(kernel.scheduler),
    setTimeout: kernel.scheduler.setTimeout.bind(kernel.scheduler),
    TextDecoder: globalThis.TextDecoder,
    TextEncoder: globalThis.TextEncoder,
    URL: globalThis.URL,
    wx,
  }, globals)
}

export function createModuleLoader(
  registries: HeadlessHostRegistries,
  getCurrentPages: () => any[],
  getApp: () => any,
  wxDriver: Parameters<typeof createHeadlessWx>[0],
  options: {
    artifactSource: ArtifactSource
    globals?: Record<string, unknown>
    kernel: RuntimeKernel
    miniprogramRootPath: string
    onConsole?: (entry: import('../kernel').RuntimeConsoleEntry) => void
    plugins: HeadlessPluginDescriptor[]
  },
): HeadlessModuleLoader {
  const workers = createWorkerHost({
    root: options.miniprogramRootPath,
    read: file => options.artifactSource.readText(file),
    console: options.kernel.diagnostics.createConsole(console, options.onConsole),
    createExecutor(globals) {
      const realm = vm.createContext(globals)
      return (source, file, module, require) => {
        const execute = new vm.Script(`(function(module, exports, require) {${source}\n})`, { filename: file }).runInContext(realm)
        execute(module, module.exports, require)
      }
    },
  })
  const moduleCache = new Map<string, ModuleCacheEntry>()
  const executionContext: Record<string, any> = createExecutionContext(
    registries,
    getCurrentPages,
    getApp,
    wxDriver,
    options.kernel,
    options.globals ?? {},
    options.onConsole,
    workers.apis,
  )
  executionContext.globalThis = executionContext

  function executeModule(filePath: string, loadContext: HeadlessHostLoadContext | null) {
    const resolvedPath = path.resolve(filePath)
    const cached = moduleCache.get(resolvedPath)
    if (cached) {
      return cached
    }

    const source = options.artifactSource.readText(resolvedPath)
    if (source == null) {
      throw new TypeError(`Missing module in headless runtime: ${normalize(resolvedPath)}`)
    }
    const module: ModuleCacheEntry = {
      source,
      componentDefinitions: [],
      exports: {},
    }
    moduleCache.set(resolvedPath, module)
    const registeredDefinitionsBefore = new Set(registries.components.values())
    const requiredComponentDefinitions: HeadlessComponentDefinition[] = []

    const previousLoadContext = registries.currentLoadContext
    registries.currentLoadContext = loadContext

    const localRequire = ((request: string) => {
      const requiredPath = resolveMiniProgramModule(
        resolvedPath,
        request,
        options.miniprogramRootPath,
        candidate => options.artifactSource.readText(candidate) !== undefined,
      )
      if (!requiredPath) {
        throw createRequireNotFoundError(request, resolvedPath)
      }
      if (requiredPath.endsWith('.json')) {
        const content = options.artifactSource.readText(requiredPath)
        if (content == null) {
          throw createRequireNotFoundError(request, resolvedPath)
        }
        return JSON.parse(content)
      }
      const requiredModule = executeModule(requiredPath, null)
      requiredComponentDefinitions.push(...requiredModule.componentDefinitions)
      return requiredModule.exports
    }) as LocalRequire
    localRequire.async = request => Promise.resolve().then(() => localRequire(request))

    try {
      const script = new vm.Script(
        `(function (exports, module, require, __filename, __dirname) { ${transformMiniProgramModule(source)}\n})`,
        {
          filename: resolvedPath,
        },
      )
      const runtime = script.runInNewContext(executionContext)
      runtime(module.exports, module, localRequire, resolvedPath, path.dirname(resolvedPath))
      const registeredDefinitions = [...registries.components.values()]
        .filter(definition => !registeredDefinitionsBefore.has(definition))
      module.componentDefinitions = [...new Set([
        ...requiredComponentDefinitions,
        ...(loadContext?.componentDefinitions ?? []),
        ...registeredDefinitions,
      ])]
      return module
    }
    catch (error) {
      moduleCache.delete(resolvedPath)
      throw error
    }
    finally {
      registries.currentLoadContext = previousLoadContext
    }
  }

  executionContext.requirePlugin = (alias: string) => {
    const plugin = options.plugins.find(item => item.alias === alias)
    if (!plugin) {
      throw new Error(`Unknown local plugin "${alias}" in headless runtime.`)
    }
    const main = typeof plugin.config.main === 'string' && plugin.config.main
      ? plugin.config.main
      : 'index.js'
    const entryPath = path.resolve(options.miniprogramRootPath, plugin.virtualRoot, main)
    return executeModule(entryPath, null).exports
  }

  const loader: HeadlessModuleLoader = {
    evaluate<T>(source: string, args: any[]): T {
      const callback = new vm.Script(`(${source})`).runInNewContext(executionContext)
      if (typeof callback !== 'function') {
        throw new TypeError('Headless evaluator must be a function or function source string.')
      }
      return callback(...args)
    },
    close() {
      workers.close()
      moduleCache.clear()
      closeRuntimeWxsLoader(loader)
    },
    executeAppModule(filePath) {
      executeModule(filePath, { kind: 'app' })
      return registries.appDefinition ?? registerAppDefinition(registries, {})
    },
    executePageModule(filePath, route) {
      const componentDefinitions: HeadlessComponentDefinition[] = []
      const loadedModule = executeModule(filePath, { kind: 'page', route, componentDefinitions })
      const fallbackDefinition = loadedModule.componentDefinitions.at(-1)
      const definition = registries.pages.get(route)
        ?? (fallbackDefinition ? normalizeComponentPageDefinition(fallbackDefinition) : undefined)
      if (!registries.pages.has(route) && definition) {
        registerPageDefinition(registries, definition, route)
      }
      if (!definition) {
        throw new Error(`Page() was not registered for route "${route}" while executing ${normalize(filePath)}.`)
      }
      return definition
    },
    reloadPageModule(filePath, route) {
      const resolvedPath = path.resolve(filePath)
      return reloadPageModuleDefinition({
        filePath: resolvedPath,
        route,
        source: options.artifactSource.readText(resolvedPath),
        cache: moduleCache,
        registries,
        execute: () => loader.executePageModule(resolvedPath, route),
      })
    },
    executeComponentModule(filePath, id) {
      const loadedModule = executeModule(filePath, { kind: 'component', route: id })
      const definition = registries.components.get(id)
        ?? registerExportedComponentDefinition(
          registries,
          id,
          loadedModule.exports,
          loadedModule.componentDefinitions.at(-1),
        )
      if (!definition) {
        throw new Error(`Component() was not registered for id "${id}" while executing ${normalize(filePath)}.`)
      }
      return definition
    },
    wx: executionContext.wx,
  }
  return loader
}
