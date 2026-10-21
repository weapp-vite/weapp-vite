import type { ArtifactSource } from '../kernel/artifactSource'
import type { TemplateNodeLike } from './templateRuntime'
import { dirname, isAbsolute, join, normalize, relative } from 'pathe'
import { parseWxsTemplateDocument } from './wxsDocument'

/** 编译模板及递归依赖共用全局注册图，图外原生模板继续实时读取。 */
export function createTemplateRegistration(
  source: ArtifactSource,
  projectRoot: string,
  compiledTemplatePaths: readonly string[] = [],
) {
  const root = normalize(projectRoot)
  const normalizeTemplatePath = (filePath: string) => {
    const normalized = normalize(filePath)
    const local = relative(root, normalized)
    if (!normalized.endsWith('.wxml') || isAbsolute(local) || local === '..' || local.startsWith('../')) {
      throw new TypeError('Compiled template paths must stay inside the mini-program root and end in .wxml.')
    }
    return normalized
  }
  const resolveRelativeTemplatePath = (filePath: string) => {
    const local = normalize(filePath)
    if (isAbsolute(local) || local === '..' || local.startsWith('../')) {
      throw new TypeError('Compiled template paths must stay inside the mini-program root and end in .wxml.')
    }
    return normalizeTemplatePath(join(root, local))
  }
  const entries = [...new Set(compiledTemplatePaths.map((filePath) => {
    if (typeof filePath !== 'string' || !filePath || isAbsolute(filePath)) {
      throw new TypeError('Compiled template paths must be project-relative WXML paths.')
    }
    return resolveRelativeTemplatePath(filePath)
  }))]
  let registered = new Map<string, string>()

  function readSnapshot() {
    const snapshot = new Map<string, string>()
    const collect = (filePath: string) => {
      filePath = normalizeTemplatePath(filePath)
      if (snapshot.has(filePath)) {
        return
      }
      const content = source.readText(filePath)
      if (content === undefined) {
        throw new Error(`Missing compiled template during host registration: ${relative(root, filePath)}`)
      }
      snapshot.set(filePath, content)
      const visit = (node: TemplateNodeLike) => {
        const request = node.attribs?.src
        if ((node.name === 'include' || node.name === 'import') && request) {
          const target = (request.endsWith('.wxml') ? request : `${request}.wxml`).replaceAll('\\', '/')
          if (isAbsolute(target) && !target.startsWith('/')) {
            throw new TypeError('Compiled template paths must stay inside the mini-program root and end in .wxml.')
          }
          collect(resolveRelativeTemplatePath(target.startsWith('/')
            ? target.slice(1)
            : join(relative(root, dirname(filePath)), target)))
        }
        for (const child of node.children ?? []) {
          visit(child)
        }
      }
      visit(parseWxsTemplateDocument(content) as unknown as TemplateNodeLike)
    }
    for (const filePath of entries) {
      collect(filePath)
    }
    return snapshot
  }

  function reload() {
    const snapshot = readSnapshot()
    const changed = snapshot.size !== registered.size
      || [...snapshot].some(([filePath, content]) => registered.get(filePath) !== content)
    registered = snapshot
    return changed
  }

  reload()
  return {
    artifactSource: {
      has: filePath => registered.has(normalize(filePath)) || source.has(filePath),
      readText: filePath => registered.get(normalize(filePath)) ?? source.readText(filePath),
    } satisfies ArtifactSource,
    reload,
  }
}
