import type { NpmPackage, ReferenceGraph, ReferenceTarget } from './types'
import { TYPE_OR_MAP_RE } from './files'
import { resolveCandidates } from './graph'

function addAllFiles(keptByRoot: Map<string, Set<string>>, entry: NpmPackage) {
  const kept = keptByRoot.get(entry.root)!
  for (const file of entry.files.keys()) {
    kept.add(file)
  }
}

/** 计算每个 npm 包的引用闭包；解析失败时按目标边界保守保留。 */
export function collectClosures(packages: Map<string, NpmPackage>, graph: ReferenceGraph) {
  const keptByRoot = new Map<string, Set<string>>([...packages.keys()].map(root => [root, new Set<string>()]))
  const pending: ReferenceTarget[] = []
  for (const [root, state] of graph.packages) {
    for (const relative of state.seeds) {
      pending.push({ root, relative })
    }
  }
  for (const entry of packages.values()) {
    if (graph.fallbackBases.has(entry.boundary)) {
      addAllFiles(keptByRoot, entry)
    }
  }
  while (pending.length) {
    const target = pending.pop()!
    const entry = packages.get(target.root)
    if (!entry || graph.fallbackBases.has(entry.base)) {
      continue
    }
    const state = graph.packages.get(target.root)
    if (state?.fallback) {
      addAllFiles(keptByRoot, entry)
      for (const dependencies of state.edges.values()) {
        pending.push(...dependencies.filter(dependency => !keptByRoot.get(dependency.root)?.has(dependency.relative)))
      }
      continue
    }
    const matches = resolveCandidates(target.relative, entry.files)
    if (!matches.length) {
      continue
    }
    const kept = keptByRoot.get(target.root)!
    for (const file of matches) {
      if (TYPE_OR_MAP_RE.test(file) || kept.has(file)) {
        continue
      }
      const stem = file.replace(/\.[^.]+$/, '')
      const group = [...entry.files.keys()].filter(candidate => candidate === file || candidate.replace(/\.[^.]+$/, '') === stem)
      for (const candidate of group) {
        if (!TYPE_OR_MAP_RE.test(candidate)) {
          kept.add(candidate)
        }
      }
      for (const candidate of group) {
        const dependencies = state?.edges.get(`${target.root}\0${candidate}`) ?? []
        pending.push(...dependencies.filter(dependency => !keptByRoot.get(dependency.root)?.has(dependency.relative)))
      }
    }
  }
  return keptByRoot
}
