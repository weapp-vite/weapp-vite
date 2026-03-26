import type {
  HeadlessAppDefinition,
  HeadlessComponentDefinition,
  HeadlessHostLoadContext,
  HeadlessHostRegistries,
  HeadlessPageDefinition,
} from '../host'
import { dirname, join, normalize } from 'pathe'
import {
  createHeadlessWx,
  registerAppDefinition,
  registerComponentDefinition,
  registerPageDefinition,
} from '../host'
import {
  type BrowserVirtualFiles,
  hasBrowserVirtualFile,
  readBrowserVirtualFile,
} from './virtualFiles'

export interface BrowserModuleLoader {
  executeAppModule: (filePath: string) => HeadlessAppDefinition
  executePageModule: (filePath: string, route: string) => HeadlessPageDefinition
}

interface ModuleCacheEntry {
  exports: Record<string, any>
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
) {
  const wx = createHeadlessWx(wxDriver)

  return {
    App(definition: HeadlessAppDefinition) {
      return registerAppDefinition(registries, definition)
    },
    Component(definition: HeadlessComponentDefinition) {
      return registerComponentDefinition(registries, definition)
    },
    Page(definition: HeadlessPageDefinition) {
      return registerPageDefinition(registries, definition)
    },
    URLSearchParams,
    clearInterval,
    clearTimeout,
    console,
    getApp,
    getCurrentPages,
    globalThis: undefined as any,
    require: undefined as any,
    setInterval,
    setTimeout,
    wx,
  }
}

export function createBrowserModuleLoader(
  files: BrowserVirtualFiles,
  registries: HeadlessHostRegistries,
  getCurrentPages: () => any[],
  getApp: () => any,
  wxDriver: Parameters<typeof createHeadlessWx>[0],
): BrowserModuleLoader {
  const moduleCache = new Map<string, ModuleCacheEntry>()
  const executionContext = createExecutionContext(registries, getCurrentPages, getApp, wxDriver)
  executionContext.globalThis = executionContext

  function executeModule(filePath: string, loadContext: HeadlessHostLoadContext | null) {
    const resolvedPath = normalize(filePath)
    const cached = moduleCache.get(resolvedPath)
    if (cached) {
      return cached.exports
    }

    const source = readBrowserVirtualFile(files, resolvedPath)
    if (typeof source !== 'string') {
      throw new Error(`Missing virtual module in browser simulator runtime: ${resolvedPath}`)
    }

    const module = { exports: {} as Record<string, any> }
    moduleCache.set(resolvedPath, module)

    const previousLoadContext = registries.currentLoadContext
    registries.currentLoadContext = loadContext

    const localRequire = (request: string) => {
      const requiredPath = resolveRequiredModulePath(files, resolvedPath, request)
      if (requiredPath.endsWith('.json')) {
        const content = readBrowserVirtualFile(files, requiredPath)
        if (typeof content !== 'string') {
          throw new Error(`Missing virtual json module in browser simulator runtime: ${requiredPath}`)
        }
        return JSON.parse(content)
      }
      return executeModule(requiredPath, null)
    }

    try {
      const contextEntries = Object.entries(executionContext)
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
      return module.exports
    }
    finally {
      registries.currentLoadContext = previousLoadContext
    }
  }

  return {
    executeAppModule(filePath) {
      executeModule(filePath, { kind: 'app' })
      if (!registries.appDefinition) {
        throw new Error(`App() was not registered while executing ${normalize(filePath)} in browser simulator runtime.`)
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
  }
}
