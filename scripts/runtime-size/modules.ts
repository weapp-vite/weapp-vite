import type { Metafile } from 'esbuild'
import type { RuntimeSizeRetainedModules } from '../runtime-size'

import path from 'node:path'

export function compareStrings(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function isPortableAbsolutePath(value: string) {
  return value.startsWith('/') || /^[A-Za-z]:\//u.test(value)
}

export function normalizePosixPath(value: string) {
  return path.posix.normalize(value.replaceAll('\\', '/'))
}

export function normalizeRuntimeModulePath(root: string, modulePath: string) {
  const normalizedRootInput = normalizePosixPath(root)
  const normalizedRoot = isPortableAbsolutePath(normalizedRootInput)
    ? normalizedRootInput
    : normalizePosixPath(path.resolve(root))
  const normalizedModule = normalizePosixPath(modulePath)
  if (!isPortableAbsolutePath(normalizedModule)) {
    return normalizedModule.replace(/^\.\//u, '')
  }

  const windowsPath = /^[A-Za-z]:\//u.test(normalizedRoot)
  const comparableRoot = windowsPath ? normalizedRoot.toLowerCase() : normalizedRoot
  const comparableModule = windowsPath ? normalizedModule.toLowerCase() : normalizedModule
  if (comparableModule === comparableRoot) {
    return '.'
  }
  if (comparableModule.startsWith(`${comparableRoot}/`)) {
    return normalizedModule.slice(normalizedRoot.length + 1)
  }
  return path.posix.relative(normalizedRoot, normalizedModule)
}

export function createRuntimeSizeRetainedModules(root: string, metafile: Metafile): RuntimeSizeRetainedModules {
  const output = Object.values(metafile.outputs).find(candidate => candidate.entryPoint)
    ?? Object.values(metafile.outputs)[0]
  if (!output?.entryPoint) {
    throw new Error('Runtime size metafile did not contain an entry output.')
  }

  const retainedInputs = {
    ...output.inputs,
    ...(!(output.entryPoint in output.inputs)
      ? { [output.entryPoint]: { bytesInOutput: 0 } }
      : {}),
  }

  const normalizedPaths = new Map(
    Object.keys(retainedInputs).map(input => [input, normalizeRuntimeModulePath(root, input)]),
  )
  const retainedPaths = new Set(normalizedPaths.values())
  const inputPaths = new Set(Object.keys(metafile.inputs).map(input => normalizeRuntimeModulePath(root, input)))
  const importGraph = Object.entries(metafile.inputs)
    .map(([input, details]) => ({
      path: normalizeRuntimeModulePath(root, input),
      imports: [...new Set(details.imports
        .filter(dependency => !dependency.external)
        .map(dependency => normalizeRuntimeModulePath(root, dependency.path))
        .filter(dependency => inputPaths.has(dependency)))].sort(compareStrings),
    }))
    .sort((left, right) => compareStrings(left.path, right.path))
  const sourceImports = new Map(importGraph.map(module => [module.path, module.imports]))
  const modules = Object.entries(retainedInputs)
    .map(([input, details]) => {
      const modulePath = normalizedPaths.get(input)!
      return {
        path: modulePath,
        bytesInOutput: details.bytesInOutput,
        imports: (sourceImports.get(modulePath) ?? []).filter(dependency => retainedPaths.has(dependency)),
      }
    })
    .sort((left, right) => compareStrings(left.path, right.path))

  return {
    entry: normalizeRuntimeModulePath(root, output.entryPoint),
    modules,
    importGraph,
  }
}

function findShortestRuntimeImportChain(
  retainedModules: RuntimeSizeRetainedModules,
  modulePath: string,
  includeZeroByteImporters: boolean,
) {
  const modulesByPath = new Map(retainedModules.modules.map(module => [module.path, module]))
  const graph = new Map((retainedModules.importGraph ?? retainedModules.modules).map(module => [module.path, module.imports]))
  const previous = new Map<string, string | undefined>([[retainedModules.entry, undefined]])
  const queue = [retainedModules.entry]

  for (let index = 0; index < queue.length; index += 1) {
    const importer = queue[index]!
    if (importer === modulePath) {
      const chain: string[] = []
      let current: string | undefined = modulePath
      while (current !== undefined) {
        chain.push(current)
        current = previous.get(current)
      }
      return chain.reverse()
    }

    const imports = [...(graph.get(importer) ?? [])].sort(compareStrings)
    for (const imported of imports) {
      const importedModule = modulesByPath.get(imported)
      const contributesNoBytes = imported !== modulePath && (importedModule?.bytesInOutput ?? 0) === 0
      if (
        !graph.has(imported)
        || previous.has(imported)
        || (!includeZeroByteImporters && contributesNoBytes)
      ) {
        continue
      }
      previous.set(imported, importer)
      queue.push(imported)
    }
  }
}

export function resolveRuntimeImportChain(
  retainedModules: RuntimeSizeRetainedModules,
  modulePath: string,
): string[] {
  return findShortestRuntimeImportChain(retainedModules, modulePath, false)
    ?? findShortestRuntimeImportChain(retainedModules, modulePath, true)
    ?? [retainedModules.entry, '[no live import path]', modulePath]
}
