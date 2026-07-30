import type {
  HeadlessAppDefinition,
  HeadlessBehaviorDefinition,
  HeadlessComponentDefinition,
  HeadlessHostLoadContext,
  HeadlessHostRegistries,
  HeadlessPageDefinition,
  HeadlessWx,
} from '../host'
import type { ArtifactSource, RuntimeKernel } from '../kernel'
import path from 'node:path'
import process from 'node:process'
import vm from 'node:vm'
import { normalize } from 'pathe'
import {
  createHeadlessWx,
  registerAppDefinition,
  registerComponentDefinition,
  registerExportedComponentDefinition,
  registerPageDefinition,
} from '../host'

export interface HeadlessModuleLoader {
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
  return new Error(`Cannot resolve require("${request}") from ${normalize(importer)} in headless runtime.`)
}

function resolveRequiredModulePath(artifactSource: ArtifactSource, importer: string, request: string) {
  if (!request.startsWith('.')) {
    throw createRequireNotFoundError(request, importer)
  }

  const basePath = path.resolve(path.dirname(importer), request)
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.json`,
    path.join(basePath, 'index.js'),
  ]

  for (const candidate of candidates) {
    if (artifactSource.has(candidate)) {
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

  return {
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
    console: kernel.diagnostics.createConsole(),
    clearInterval: (handle: ReturnType<typeof setInterval>) => kernel.scheduler.clearInterval(handle),
    clearTimeout: (handle: ReturnType<typeof setTimeout>) => kernel.scheduler.clearTimeout(handle),
    getApp,
    getCurrentPages,
    globalThis: undefined as any,
    process,
    require: undefined as any,
    setInterval: kernel.scheduler.setInterval.bind(kernel.scheduler),
    setTimeout: kernel.scheduler.setTimeout.bind(kernel.scheduler),
    wx,
    ...globals,
  }
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
  },
): HeadlessModuleLoader {
  const moduleCache = new Map<string, ModuleCacheEntry>()
  const executionContext = createExecutionContext(
    registries,
    getCurrentPages,
    getApp,
    wxDriver,
    options.kernel,
    options.globals ?? {},
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
      componentDefinitions: [],
      exports: {},
    }
    moduleCache.set(resolvedPath, module)
    const registeredDefinitionsBefore = new Set(registries.components.values())
    const requiredComponentDefinitions: HeadlessComponentDefinition[] = []

    const previousLoadContext = registries.currentLoadContext
    registries.currentLoadContext = loadContext

    const localRequire = ((request: string) => {
      const requiredPath = resolveRequiredModulePath(options.artifactSource, resolvedPath, request)
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
        `(function (exports, module, require, __filename, __dirname) { ${source}\n})`,
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
        ...registeredDefinitions,
      ])]
      return module
    }
    finally {
      registries.currentLoadContext = previousLoadContext
    }
  }

  return {
    close() {
      moduleCache.clear()
    },
    executeAppModule(filePath) {
      executeModule(filePath, { kind: 'app' })
      if (!registries.appDefinition) {
        throw new Error(`App() was not registered while executing ${normalize(filePath)} in headless runtime.`)
      }
      return registries.appDefinition
    },
    executePageModule(filePath, route) {
      executeModule(filePath, { kind: 'page', route })
      const definition = registries.pages.get(route)
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
