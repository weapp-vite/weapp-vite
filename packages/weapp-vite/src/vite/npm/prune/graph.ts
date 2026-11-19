import type { OutputBundle } from 'rolldown'
import type { PreparedNpmOutput } from '../output'
import type { NpmPackage, PackageInfo, ReferenceGraph, ReferenceSet, ReferenceTarget } from './types'
import path from 'pathe'
import { collectFileReferences, textOf } from './files'

const NPM_DIRECTORY_NAMES = new Set(['miniprogram_npm', 'node_modules'])

export function normalizeFileName(fileName: string) {
  return path.posix.normalize(fileName.replaceAll('\\', '/')).replace(/^\.\//, '')
}

export function logicalFileName(output: PreparedNpmOutput, directory: string, fileName: string) {
  const logicalRoot = output.externalRoots?.get(directory) ?? path.basename(normalizeFileName(directory))
  return path.posix.join(logicalRoot, fileName.replaceAll('\\', '/'))
}

export function packageInfo(fileName: string): PackageInfo | undefined {
  const parts = normalizeFileName(fileName).split('/')
  const npmIndex = parts.findLastIndex(part => NPM_DIRECTORY_NAMES.has(part))
  if (npmIndex < 0 || !parts[npmIndex + 1]) {
    return
  }
  const boundaryIndex = parts.findIndex(part => NPM_DIRECTORY_NAMES.has(part))
  const packageEnd = parts[npmIndex + 1]!.startsWith('@') ? npmIndex + 3 : npmIndex + 2
  if (!parts[packageEnd - 1]) {
    return
  }
  return {
    root: parts.slice(0, packageEnd).join('/'),
    base: parts.slice(0, npmIndex + 1).join('/'),
    boundary: parts.slice(0, boundaryIndex + 1).join('/'),
    name: parts.slice(npmIndex + 1, packageEnd).join('/'),
    relative: parts.slice(packageEnd).join('/'),
  }
}

export function collectPackages(output: PreparedNpmOutput) {
  const packages = new Map<string, NpmPackage>()
  const add = (fileName: string | undefined, source: string | Uint8Array) => {
    if (!fileName) {
      return
    }
    const info = packageInfo(fileName)
    if (!info) {
      return
    }
    const packageEntry = packages.get(info.root) ?? {
      root: info.root,
      base: info.base,
      boundary: info.boundary,
      name: info.name,
      files: new Map<string, { fileName: string, source: string | Uint8Array }>(),
    }
    packageEntry.files.set(info.relative, { fileName, source })
    packages.set(info.root, packageEntry)
  }
  for (const asset of output.assets) {
    add(asset.fileName, asset.source)
  }
  for (const [directory, assets] of output.external) {
    for (const asset of assets) {
      if (asset.fileName) {
        add(logicalFileName(output, directory, asset.fileName), asset.source)
      }
    }
  }
  return packages
}

export function resolveCandidates(relative: string, files: Map<string, { fileName: string, source: string | Uint8Array }>) {
  const normalized = normalizeFileName(relative)
  const candidates = new Set<string>([normalized])
  if (!files.has(normalized)) {
    for (const file of files.keys()) {
      if (file.startsWith(`${normalized}.`)) {
        candidates.add(file)
      }
    }
  }
  if (!path.posix.extname(normalized)) {
    candidates.add(path.posix.join(normalized, 'index.js'))
    candidates.add(path.posix.join(normalized, 'index.json'))
    candidates.add(path.posix.join(normalized, 'index.wxml'))
    candidates.add(path.posix.join(normalized, 'index.wxss'))
  }
  return [...candidates].filter(candidate => files.has(candidate))
}

function resolvePackageSpecifier(specifier: string, boundary: string, packages: Map<string, NpmPackage>, preferredBase?: string) {
  const normalized = normalizeFileName(specifier.replace(/^\//, ''))
  const explicit = normalized.match(/(?:^|\/)(miniprogram_npm|node_modules)\/(.+)$/)
  if (explicit) {
    const info = packageInfo(path.posix.join(explicit[1]!, explicit[2]!))
    if (info && packages.has(info.root)) {
      return { info, relative: info.relative }
    }
  }
  const matches = [...packages.values()]
    .filter(entry => entry.boundary === boundary && (normalized === entry.name || normalized.startsWith(`${entry.name}/`)))
    .sort((left, right) => {
      const leftBasePriority = left.base === preferredBase ? 0 : left.base === boundary ? 1 : 2
      const rightBasePriority = right.base === preferredBase ? 0 : right.base === boundary ? 1 : 2
      return leftBasePriority - rightBasePriority || right.name.length - left.name.length
    })
  const match = matches[0]
  if (!match) {
    return
  }
  return {
    info: { root: match.root, base: match.base, boundary: match.boundary, name: match.name, relative: '' },
    relative: normalized.slice(match.name.length).replace(/^\//, ''),
  }
}

function resolveReference(current: string, reference: string, packageEntry: NpmPackage, packages: Map<string, NpmPackage>): ReferenceTarget[] {
  const value = reference.trim().split(/[?#]/, 1)[0]!
  if (!value || /^(?:https?:|data:|\/\/)/i.test(value) || value.startsWith('{{')) {
    return []
  }
  if (value.startsWith('.') || value.startsWith('/')) {
    const target = value.startsWith('/')
      ? normalizeFileName(value.slice(1))
      : normalizeFileName(path.posix.join(packageEntry.root, path.posix.dirname(current), value))
    const info = packageInfo(target)
    if (info && packages.has(info.root)) {
      return resolveCandidates(info.relative, packages.get(info.root)!.files).map(relative => ({ root: info.root, relative }))
    }
    return resolveCandidates(path.posix.relative(packageEntry.root, target), packageEntry.files)
      .map(relative => ({ root: packageEntry.root, relative }))
  }
  const resolved = resolvePackageSpecifier(value, packageEntry.boundary, packages, packageEntry.base)
  if (!resolved) {
    return []
  }
  return resolveCandidates(resolved.relative, packages.get(resolved.info.root)!.files)
    .map(relative => ({ root: resolved.info.root, relative }))
}

function isIgnorableReference(reference: string) {
  const value = reference.trim().split(/[?#]/, 1)[0]!
  return !value || /^(?:https?:|data:|\/\/)/i.test(value) || value.startsWith('{{')
}

function packageBaseForConsumer(fileName: string, packages: Map<string, NpmPackage>) {
  const consumer = normalizeFileName(fileName)
  const bases = new Map<string, number>()
  for (const entry of packages.values()) {
    const separator = entry.boundary.lastIndexOf('/')
    const marker = separator < 0 ? '' : entry.boundary.slice(0, separator)
    if (!marker || consumer === marker || consumer.startsWith(`${marker}/`)) {
      bases.set(entry.boundary, marker.length)
    }
  }
  if (bases.size) {
    return [...bases].sort((left, right) => right[1] - left[1])[0]![0]
  }
  return [...packages.values()].find(entry => entry.boundary === 'miniprogram_npm')?.boundary ?? 'miniprogram_npm'
}

function resolveBundleReference(fileName: string, reference: string, boundary: string, packages: Map<string, NpmPackage>) {
  const value = reference.trim().split(/[?#]/, 1)[0]!
  if (!value || /^(?:https?:|data:|\/\/)/i.test(value) || value.startsWith('{{')) {
    return []
  }
  if (value.startsWith('.') || value.startsWith('/')) {
    const target = value.startsWith('/')
      ? normalizeFileName(value.slice(1))
      : normalizeFileName(path.posix.join(path.posix.dirname(fileName), value))
    const info = packageInfo(target)
    if (!info || !packages.has(info.root)) {
      return []
    }
    return resolveCandidates(info.relative, packages.get(info.root)!.files).map(relative => ({ root: info.root, relative }))
  }
  const resolved = resolvePackageSpecifier(value, boundary, packages)
  if (!resolved) {
    return []
  }
  return resolveCandidates(resolved.relative, packages.get(resolved.info.root)!.files)
    .map(relative => ({ root: resolved.info.root, relative }))
}

function collectBundleReferences(bundle: OutputBundle) {
  return Object.entries(bundle).map(([fileName, item]) => ({
    fileName: normalizeFileName(fileName),
    text: item.type === 'asset' ? textOf(item.source) : item.code,
  }))
}

/** 建立最终 bundle 到 npm 文件的引用图，并按 npm 边界记录回退范围。 */
export function buildReferenceGraph(bundle: OutputBundle, packages: Map<string, NpmPackage>): ReferenceGraph {
  const roots = new Map<string, ReferenceSet>()
  const fallbackBases = new Map<string, string>()
  const rootSet = (root: string) => {
    const result = roots.get(root) ?? { seeds: new Set<string>(), edges: new Map<string, ReferenceTarget[]>() }
    roots.set(root, result)
    return result
  }
  for (const item of collectBundleReferences(bundle)) {
    const base = packageBaseForConsumer(item.fileName, packages)
    const references = new Set<string>()
    const reason = collectFileReferences(item.fileName, item.text, references)
    if (reason) {
      for (const entry of packages.values()) {
        if (entry.boundary === base) {
          fallbackBases.set(base, `${item.fileName}: ${reason}`)
        }
      }
      continue
    }
    for (const reference of references) {
      for (const target of resolveBundleReference(item.fileName, reference, base, packages)) {
        rootSet(target.root).seeds.add(target.relative)
      }
    }
  }
  for (const entry of packages.values()) {
    for (const [relative, file] of entry.files) {
      const state = rootSet(entry.root)
      if (/^(?:package\.json|\.wechatide\.ib\.json|LICENSE(?:\.[^/]+)?|README(?:\.[^/]+)?)$/i.test(relative) || /\.d\.ts$|\.map$/i.test(relative)) {
        state.edges.set(`${entry.root}\0${relative}`, [])
        continue
      }
      const references = new Set<string>()
      const reason = collectFileReferences(file.fileName, textOf(file.source), references)
      if (reason) {
        state.fallback ??= `${file.fileName}: ${reason}`
        continue
      }
      const edges: ReferenceTarget[] = []
      for (const reference of references) {
        const targets = resolveReference(relative, reference, entry, packages)
        if (!targets.length && !isIgnorableReference(reference)) {
          state.fallback ??= `${file.fileName}: 无法解析静态引用 "${reference}"`
        }
        edges.push(...targets)
      }
      state.edges.set(`${entry.root}\0${relative}`, edges)
    }
  }
  return { packages: roots, fallbackBases }
}
