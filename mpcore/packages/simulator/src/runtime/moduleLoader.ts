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
  normalizeComponentPageDefinition,
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

const ESM_IMPORT_LINE_RE = /^[ \t]*import[^\n]*$/gm
const ESM_EXPORT_LIST_RE = /^[ \t]*export[ \t]*\{([^}\n]+)\}[ \t]*;?$/gm
const ESM_EXPORT_DECLARATION_RE = /\bexport\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g
const ESM_EXPORT_DEFAULT_DECLARATION_RE = /\bexport\s+default\s+(function|class)\s+([A-Za-z_$][\w$]*)/g

function isImportWhitespace(value: string | undefined) {
  return value === ' ' || value === '\t'
}

type ParsedEsmImport
  = | { request: string, sideEffect: true }
    | { request: string, sideEffect: false, specifier: string }

function parseEsmImportLine(line: string): ParsedEsmImport | undefined {
  let statement = line.trim().slice('import'.length).trim()
  if (statement.endsWith(';')) {
    statement = statement.slice(0, -1).trimEnd()
  }

  if (statement.startsWith('"') || statement.startsWith('\'')) {
    const quote = statement[0]
    if (statement.endsWith(quote) && statement.length > 1) {
      return {
        request: statement.slice(1, -1),
        sideEffect: true,
      }
    }
    return
  }

  let fromIndex = statement.indexOf('from')
  while (fromIndex >= 0) {
    if (isImportWhitespace(statement[fromIndex - 1]) && isImportWhitespace(statement[fromIndex + 4])) {
      break
    }
    fromIndex = statement.indexOf('from', fromIndex + 4)
  }
  if (fromIndex < 0) {
    return
  }

  const specifier = statement.slice(0, fromIndex).trim()
  const requestLiteral = statement.slice(fromIndex + 4).trim()
  const quote = requestLiteral[0]
  if (
    !specifier
    || (quote !== '"' && quote !== '\'')
    || requestLiteral.length < 2
    || !requestLiteral.endsWith(quote)
  ) {
    return
  }
  return {
    request: requestLiteral.slice(1, -1),
    sideEffect: false,
    specifier,
  }
}

function createEsmImportBindings(specifier: string, request: string, index: number) {
  const namespaceName = `__headlessEsmImport${index}`
  const statements = [`const ${namespaceName} = require(${JSON.stringify(request)});`]
  const normalizedSpecifier = specifier.trim()

  if (normalizedSpecifier.startsWith('{') && normalizedSpecifier.endsWith('}')) {
    const entries = normalizedSpecifier.slice(1, -1).split(',')
    for (const entry of entries) {
      const [importedName, localName] = entry.trim().split(/\s+as\s+/)
      if (!importedName) {
        continue
      }
      const bindingName = localName || importedName
      statements.push(`const ${bindingName} = ${namespaceName}[${JSON.stringify(importedName)}];`)
    }
    return statements.join('\n')
  }

  if (normalizedSpecifier.startsWith('* as ')) {
    const bindingName = normalizedSpecifier.slice('* as '.length).trim()
    statements.push(`const ${bindingName} = ${namespaceName};`)
    return statements.join('\n')
  }

  const [defaultName, namedPart] = normalizedSpecifier.split(/\s*,\s*/, 2)
  if (defaultName) {
    statements.push(`const ${defaultName.trim()} = ${namespaceName}.default ?? ${namespaceName};`)
  }
  if (namedPart?.startsWith('{') && namedPart.endsWith('}')) {
    statements.push(createEsmImportBindings(namedPart, request, index).split('\n').slice(1).join('\n'))
  }
  return statements.join('\n')
}

function transformEsmToCommonJs(source: string) {
  if (!/^\s*(?:import|export)\b/m.test(source)) {
    return source
  }

  let importIndex = 0
  const exportedNames: Array<{ exported: string, local: string }> = []
  let transformed = source.replace(ESM_IMPORT_LINE_RE, (line) => {
    const parsed = parseEsmImportLine(line)
    if (!parsed) {
      return line
    }
    if (parsed.sideEffect) {
      return `require(${JSON.stringify(parsed.request)});`
    }
    return createEsmImportBindings(parsed.specifier, parsed.request, importIndex++)
  })
  transformed = transformed.replace(ESM_EXPORT_LIST_RE, (_match, entries: string) => {
    for (const entry of entries.split(',')) {
      const [local, exported] = entry.trim().split(/\s+as\s+/)
      if (local) {
        exportedNames.push({
          exported: exported || local,
          local,
        })
      }
    }
    return ''
  })
  transformed = transformed.replace(ESM_EXPORT_DEFAULT_DECLARATION_RE, (_match, kind: string, local: string) => {
    exportedNames.push({ exported: 'default', local })
    return `${kind} ${local}`
  })
  transformed = transformed.replace(ESM_EXPORT_DECLARATION_RE, (_match, kind: string, local: string) => {
    exportedNames.push({ exported: local, local })
    return `${kind} ${local}`
  })
  transformed = transformed.replace(/\bexport\s+default\s+/g, 'module.exports.default = ')

  if (exportedNames.length > 0) {
    transformed += `\n${exportedNames
      .map(({ exported, local }) => `module.exports[${JSON.stringify(exported)}] = ${local};`)
      .join('\n')}`
  }
  return transformed
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
  onConsole?: (entry: import('../kernel').RuntimeConsoleEntry) => void,
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
    console: kernel.diagnostics.createConsole(console, onConsole),
    clearInterval: (handle: ReturnType<typeof setInterval>) => kernel.scheduler.clearInterval(handle),
    clearTimeout: (handle: ReturnType<typeof setTimeout>) => kernel.scheduler.clearTimeout(handle),
    getApp,
    getCurrentPages,
    globalThis: undefined as any,
    process,
    require: undefined as any,
    setInterval: kernel.scheduler.setInterval.bind(kernel.scheduler),
    setTimeout: kernel.scheduler.setTimeout.bind(kernel.scheduler),
    TextDecoder: globalThis.TextDecoder,
    TextEncoder: globalThis.TextEncoder,
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
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
    onConsole?: (entry: import('../kernel').RuntimeConsoleEntry) => void
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
    options.onConsole,
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
        `(function (exports, module, require, __filename, __dirname) { ${transformEsmToCommonJs(source)}\n})`,
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
