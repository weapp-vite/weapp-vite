import type {
  HeadlessAppDefinition,
  HeadlessBehaviorDefinition,
  HeadlessComponentDefinition,
  HeadlessHostLoadContext,
  HeadlessHostRegistries,
  HeadlessPageDefinition,
} from '../host'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import vm from 'node:vm'
import { normalize } from 'pathe'
import {
  createHeadlessWx,
  registerAppDefinition,
  registerComponentDefinition,
  registerPageDefinition,
} from '../host'

export interface HeadlessModuleLoader {
  executeComponentModule: (filePath: string, id: string) => HeadlessComponentDefinition
  executeAppModule: (filePath: string) => HeadlessAppDefinition
  executePageModule: (filePath: string, route: string) => HeadlessPageDefinition
}

interface ModuleCacheEntry {
  exports: Record<string, any>
}

function createRequireNotFoundError(request: string, importer: string) {
  return new Error(`Cannot resolve require("${request}") from ${normalize(importer)} in headless runtime.`)
}

function resolveRequiredModulePath(importer: string, request: string) {
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
    if (fs.existsSync(candidate)) {
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
    console,
    clearTimeout,
    getApp,
    getCurrentPages,
    globalThis: undefined as any,
    process,
    require: undefined as any,
    setInterval,
    setTimeout,
    wx,
  }
}

export function createModuleLoader(
  registries: HeadlessHostRegistries,
  getCurrentPages: () => any[],
  getApp: () => any,
  wxDriver: Parameters<typeof createHeadlessWx>[0],
): HeadlessModuleLoader {
  const moduleCache = new Map<string, ModuleCacheEntry>()
  const executionContext = createExecutionContext(registries, getCurrentPages, getApp, wxDriver)
  executionContext.globalThis = executionContext

  function executeModule(filePath: string, loadContext: HeadlessHostLoadContext | null) {
    const resolvedPath = path.resolve(filePath)
    const cached = moduleCache.get(resolvedPath)
    if (cached) {
      return cached.exports
    }

    const source = fs.readFileSync(resolvedPath, 'utf8')
    const module = { exports: {} as Record<string, any> }
    moduleCache.set(resolvedPath, module)

    const previousLoadContext = registries.currentLoadContext
    registries.currentLoadContext = loadContext

    const localRequire = (request: string) => {
      const requiredPath = resolveRequiredModulePath(resolvedPath, request)
      if (requiredPath.endsWith('.json')) {
        const content = fs.readFileSync(requiredPath, 'utf8')
        return JSON.parse(content)
      }
      return executeModule(requiredPath, null)
    }

    try {
      const script = new vm.Script(
        `(function (exports, module, require, __filename, __dirname) { ${source}\n})`,
        {
          filename: resolvedPath,
        },
      )
      const runtime = script.runInNewContext(executionContext)
      runtime(module.exports, module, localRequire, resolvedPath, path.dirname(resolvedPath))
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
      executeModule(filePath, { kind: 'component', route: id })
      const definition = registries.components.get(id)
      if (!definition) {
        throw new Error(`Component() was not registered for id "${id}" while executing ${normalize(filePath)}.`)
      }
      return definition
    },
  }
}
