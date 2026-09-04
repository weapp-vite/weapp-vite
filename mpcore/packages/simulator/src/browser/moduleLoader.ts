import type {
  HeadlessAppDefinition,
  HeadlessBehaviorDefinition,
  HeadlessComponentDefinition,
  HeadlessHostLoadContext,
  HeadlessHostRegistries,
  HeadlessPageDefinition,
  HeadlessWx,
} from '../host'
import type { RuntimeKernel } from '../kernel'
import type { HeadlessPluginDescriptor } from '../project'
import type { BrowserVirtualFiles } from './virtualFiles'
import { dirname, join, normalize } from 'pathe'
import {
  createHeadlessWx,
  normalizeComponentPageDefinition,
  registerAppDefinition,
  registerComponentDefinition,
  registerExportedComponentDefinition,
  registerPageDefinition,
} from '../host'
import { createMiniProgramRuntimeGlobals } from '../runtime/runtimeGlobals'
import { hasBrowserVirtualFile, readBrowserVirtualFile } from './virtualFiles'

export interface BrowserModuleLoader {
  close: () => void
  executeComponentModule: (filePath: string, id: string) => HeadlessComponentDefinition
  executeAppModule: (filePath: string) => HeadlessAppDefinition
  executePageModule: (filePath: string, route: string) => HeadlessPageDefinition
  wx: HeadlessWx
}

interface ModuleCacheEntry {
  componentDefinitions: HeadlessComponentDefinition[]
  exports: Record<string, any>
}

interface LocalRequire {
  (request: string): any
  async: (request: string) => Promise<any>
}

function createRequireNotFoundError(request: string, importer: string) {
  return new Error(`Cannot resolve require("${request}") from ${normalize(importer)} in browser simulator runtime.`)
}

function resolveRequiredModulePath(files: BrowserVirtualFiles, importer: string, request: string) {
  if (!request.startsWith('.')) {
    throw createRequireNotFoundError(request, importer)
  }

  const basePath = normalize(join(dirname(importer), request))
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.json`,
    join(basePath, 'index.js'),
  ]

  for (const candidate of candidates) {
    if (hasBrowserVirtualFile(files, candidate)) {
      return candidate
    }
  }

  throw createRequireNotFoundError(request, importer)
}

function createExecutionContext(
  registries: HeadlessHostRegistries,
  getCurrentPages: () => any[],
  getApp: () => any,
  wxDriver: Parameters<typeof createHeadlessWx>[0],
  kernel: RuntimeKernel,
  globals: Record<string, unknown>,
) {
  const wx = createHeadlessWx(wxDriver)

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
    clearInterval: (handle: ReturnType<typeof setInterval>) => kernel.scheduler.clearInterval(handle),
    clearTimeout: (handle: ReturnType<typeof setTimeout>) => kernel.scheduler.clearTimeout(handle),
    console: kernel.diagnostics.createConsole(),
    getApp,
    getCurrentPages,
    globalThis: undefined as any,
    require: undefined as any,
    setInterval: kernel.scheduler.setInterval.bind(kernel.scheduler),
    setTimeout: kernel.scheduler.setTimeout.bind(kernel.scheduler),
    wx,
  }, globals)
}

export function createBrowserModuleLoader(
  files: BrowserVirtualFiles,
  registries: HeadlessHostRegistries,
  getCurrentPages: () => any[],
  getApp: () => any,
  wxDriver: Parameters<typeof createHeadlessWx>[0],
  options: {
    globals?: Record<string, unknown>
    kernel: RuntimeKernel
    miniprogramRootPath: string
    plugins: HeadlessPluginDescriptor[]
  },
): BrowserModuleLoader {
  const moduleCache = new Map<string, ModuleCacheEntry>()
  const executionContext: Record<string, any> = createExecutionContext(
    registries,
    getCurrentPages,
    getApp,
    wxDriver,
    options.kernel,
    options.globals ?? {},
  )
  executionContext.globalThis = executionContext

  function executeModule(filePath: string, loadContext: HeadlessHostLoadContext | null) {
    const resolvedPath = normalize(filePath)
    const cached = moduleCache.get(resolvedPath)
    if (cached) {
      return cached
    }

    const source = readBrowserVirtualFile(files, resolvedPath)
    if (typeof source !== 'string') {
      throw new TypeError(`Missing virtual module in browser simulator runtime: ${resolvedPath}`)
    }

    const module: ModuleCacheEntry = {
      componentDefinitions: [],
      exports: {},
    }
    moduleCache.set(resolvedPath, module)
    const registeredDefinitionsBefore = new Set(registries.components.values())
    const requiredComponentDefinitions: HeadlessComponentDefinition[] = []

    const previousLoadContext = registries.currentLoadContext
    registries.currentLoadContext = loadContext

    const localRequire = ((request: string) => {
      const requiredPath = resolveRequiredModulePath(files, resolvedPath, request)
      if (requiredPath.endsWith('.json')) {
        const content = readBrowserVirtualFile(files, requiredPath)
        if (typeof content !== 'string') {
          throw new TypeError(`Missing virtual json module in browser simulator runtime: ${requiredPath}`)
        }
        return JSON.parse(content)
      }
      const requiredModule = executeModule(requiredPath, null)
      requiredComponentDefinitions.push(...requiredModule.componentDefinitions)
      return requiredModule.exports
    }) as LocalRequire
    localRequire.async = request => Promise.resolve().then(() => localRequire(request))

    try {
      const contextEntries = Object.entries(executionContext)
      // eslint-disable-next-line no-new-func -- 浏览器 simulator 需要在隔离上下文执行已编译的 CommonJS 虚拟模块。
      const runtime = new Function(
        ...contextEntries.map(([key]) => key),
        'exports',
        'module',
        'require',
        '__filename',
        '__dirname',
        source,
      )
      runtime(
        ...contextEntries.map(([, value]) => value),
        module.exports,
        module,
        localRequire,
        resolvedPath,
        dirname(resolvedPath),
      )
      const registeredDefinitions = [...registries.components.values()]
        .filter(definition => !registeredDefinitionsBefore.has(definition))
      module.componentDefinitions = [...new Set([
        ...requiredComponentDefinitions,
        ...(loadContext?.componentDefinitions ?? []),
        ...registeredDefinitions,
      ])]
      return module
    }
    finally {
      registries.currentLoadContext = previousLoadContext
    }
  }

  executionContext.requirePlugin = (alias: string) => {
    const plugin = options.plugins.find(item => item.alias === alias)
    if (!plugin) {
      throw new Error(`Unknown local plugin "${alias}" in browser simulator runtime.`)
    }
    const main = typeof plugin.config.main === 'string' && plugin.config.main
      ? plugin.config.main
      : 'index.js'
    const entryPath = normalize(join(options.miniprogramRootPath, plugin.virtualRoot, main))
    return executeModule(entryPath, null).exports
  }

  return {
    close() {
      moduleCache.clear()
    },
    executeAppModule(filePath) {
      executeModule(filePath, { kind: 'app' })
      if (!registries.appDefinition) {
        throw new Error(`App() was not registered while executing ${normalize(filePath)} in browser simulator runtime.`)
      }
      return registries.appDefinition
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
}
