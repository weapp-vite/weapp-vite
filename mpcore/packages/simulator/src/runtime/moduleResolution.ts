import { dirname, join, normalize, relative } from 'pathe'

export function resolveMiniProgramModule(
  importer: string,
  request: string,
  miniprogramRootPath: string,
  hasFile: (filePath: string) => boolean,
): string | undefined {
  function resolveFile(basePath: string) {
    return [basePath, `${basePath}.js`, `${basePath}.json`, join(basePath, 'index.js')].find(hasFile)
  }

  if (request.startsWith('.')) {
    return resolveFile(join(dirname(importer), request))
  }
  if (request.includes('\\') || request.includes(':') || request.split('/').some(part => !part || part === '.' || part === '..')) {
    return
  }

  const root = normalize(miniprogramRootPath)
  let directory = dirname(importer)
  while (true) {
    const relativeDirectory = relative(root, directory)
    if (relativeDirectory === '..' || relativeDirectory.startsWith('../')) {
      return
    }
    const resolved = resolveFile(join(directory, 'miniprogram_npm', request))
    if (resolved) {
      return resolved
    }
    if (normalize(directory) === root) {
      return
    }
    const parent = dirname(directory)
    if (parent === directory) {
      return
    }
    directory = parent
  }
}
