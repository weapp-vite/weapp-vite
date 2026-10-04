import type { Profiler } from 'node:inspector'
import { createHash } from 'node:crypto'
import { posix } from 'node:path'

export type CpuSourceCategory
  = 'repository' | 'dependency' | 'node-builtin' | 'gc' | 'idle' | 'program' | 'root' | 'unattributed' | 'external-file' | 'external-url'

export interface CpuSampleCounts {
  /** 与 selfSamples 相同；百分比以所有采样点为分母，不代表墙钟耗时。 */
  sampleCount: number
  selfSamples: number
  inclusiveSamples: number
  percentOfAllSamples: number
  inclusivePercentOfAllSamples: number
}

export interface CpuFunctionSummary extends CpuSampleCounts {
  category: CpuSourceCategory
  module: string
  method: string
  functionName: string
  url: string
  /** Inspector 原始位置加一；没有执行 sourcemap 映射，未知位置为 null。 */
  line: number | null
  column: number | null
}

export interface CpuModuleSummary extends CpuSampleCounts {
  category: CpuSourceCategory
  module: string
  topFunctions: CpuFunctionSummary[]
}

export interface CpuProfileSummary {
  totalSamples: number
  modules: CpuModuleSummary[]
  topFunctions: CpuFunctionSummary[]
}

interface SourceLocation {
  category: CpuSourceCategory
  module: string
}

interface Counts {
  selfSamples: number
  inclusiveSamples: number
}

const runtimeCategories = new Map<string, CpuSourceCategory>([
  ['(garbage collector)', 'gc'],
  ['(idle)', 'idle'],
  ['(program)', 'program'],
  ['(root)', 'root'],
])

function filePath(value: string) {
  let normalized = value.replaceAll('\\', '/')
  if (normalized.startsWith('file:')) {
    const url = new URL(normalized)
    normalized = decodeURIComponent(url.pathname)
    if (url.hostname && url.hostname !== 'localhost') {
      normalized = `//${url.hostname}${normalized}`
    }
    normalized = normalized.replace(/^\/([A-Z]:\/)/i, '$1')
  }
  else {
    normalized = normalized.split(/[?#]/, 1)[0]!
  }
  return posix.normalize(normalized)
}

function externalSource(category: 'external-file' | 'external-url', value: string): SourceLocation {
  const fingerprint = createHash('sha256').update(value).digest('hex').slice(0, 12)
  return { category, module: `<${category}:${fingerprint}>` }
}

function sourceLocation(url: string, functionName: string, repositoryRoot: string): SourceLocation {
  if (!url) {
    const category = runtimeCategories.get(functionName) ?? 'unattributed'
    return { category, module: `<${category}>` }
  }
  if (/^node:[\w./-]+$/.test(url) || /^internal\/[\w./-]+$/.test(url)) {
    return { category: 'node-builtin', module: url.startsWith('node:') ? url : `node:${url}` }
  }
  if (/^[a-z][\w+.-]*:/i.test(url) && !url.startsWith('file:') && !/^[a-z]:[\\/]/i.test(url)) {
    return externalSource('external-url', url)
  }
  const filename = filePath(url)
  const dependencyMarker = '/node_modules/'
  const dependencyIndex = filename.lastIndexOf(dependencyMarker)
  if (dependencyIndex >= 0) {
    const dependency = filename.slice(dependencyIndex + dependencyMarker.length)
    if (!dependency.startsWith('.') && dependency) {
      return { category: 'dependency', module: `node_modules/${dependency}` }
    }
  }
  const windows = /^[a-z]:\//i.test(repositoryRoot)
  const candidate = windows ? filename.toLowerCase() : filename
  const root = windows ? repositoryRoot.toLowerCase() : repositoryRoot
  const prefix = `${root.replace(/\/$/, '')}/`
  if (candidate.startsWith(prefix)) {
    return { category: 'repository', module: filename.slice(prefix.length) }
  }
  return externalSource('external-file', filename)
}

function validateGraph(profile: Profiler.Profile) {
  if (!Array.isArray(profile.samples) || profile.samples.length === 0) {
    throw new Error('CPU profile requires a non-empty samples array')
  }
  if (!Array.isArray(profile.nodes) || profile.nodes.length === 0) {
    throw new Error('CPU profile requires a non-empty nodes array')
  }
  const nodes = new Map<number, Profiler.ProfileNode>()
  for (const node of profile.nodes) {
    if (!node || !Number.isSafeInteger(node.id) || node.id <= 0 || nodes.has(node.id)) {
      throw new Error('CPU profile contains an invalid or duplicate node id')
    }
    const frame = node.callFrame
    if (!frame || typeof frame.url !== 'string' || typeof frame.functionName !== 'string'
      || !Number.isSafeInteger(frame.lineNumber) || frame.lineNumber < -1
      || !Number.isSafeInteger(frame.columnNumber) || frame.columnNumber < -1) {
      throw new Error('CPU profile contains an invalid call frame')
    }
    nodes.set(node.id, node)
  }
  const parents = new Map<number, number>()
  for (const node of nodes.values()) {
    if (node.children !== undefined && !Array.isArray(node.children)) {
      throw new Error('CPU profile contains invalid children')
    }
    for (const child of node.children ?? []) {
      if (!nodes.has(child) || child === node.id || parents.has(child)) {
        throw new Error('CPU profile contains an unknown, duplicate, cyclic or shared child')
      }
      parents.set(child, node.id)
    }
  }
  const roots = [...nodes.keys()].filter(id => !parents.has(id))
  if (roots.length !== 1) {
    throw new Error('CPU profile must contain exactly one root')
  }
  const visited = new Set<number>()
  const pending = [roots[0]!]
  while (pending.length) {
    const id = pending.pop()!
    if (visited.has(id)) {
      throw new Error('CPU profile contains a cycle')
    }
    visited.add(id)
    pending.push(...(nodes.get(id)!.children ?? []))
  }
  if (visited.size !== nodes.size) {
    throw new Error('CPU profile contains disconnected or cyclic nodes')
  }
  for (const sample of profile.samples) {
    if (!Number.isSafeInteger(sample) || !nodes.has(sample)) {
      throw new Error('CPU profile sample references an unknown node')
    }
  }
  return { nodes, parents, samples: profile.samples }
}

function sampleCounts(counts: Counts, totalSamples: number): CpuSampleCounts {
  return {
    sampleCount: counts.selfSamples,
    selfSamples: counts.selfSamples,
    inclusiveSamples: counts.inclusiveSamples,
    percentOfAllSamples: counts.selfSamples / totalSamples * 100,
    inclusivePercentOfAllSamples: counts.inclusiveSamples / totalSamples * 100,
  }
}

/** 按 samples 汇总 CPU 抽样；每个采样栈中的同模块或同函数只累计一次 inclusive。 */
export function summarizeCpuProfile(profile: Profiler.Profile, repositoryRoot: string): CpuProfileSummary {
  const root = filePath(repositoryRoot)
  if (!root || !(/^[a-z]:\//i.test(root) || root.startsWith('/'))) {
    throw new Error('CPU profile repository root must be an absolute path')
  }
  const { nodes, parents, samples } = validateGraph(profile)
  const modules = new Map<string, SourceLocation & Counts>()
  const functions = new Map<string, Omit<CpuFunctionSummary, keyof CpuSampleCounts> & Counts>()
  const locations = new Map<number, { module: string, functionKey: string }>()
  for (const node of nodes.values()) {
    const frame = node.callFrame
    const location = sourceLocation(frame.url, frame.functionName, root)
    const functionName = /[\\/]|(?:file|https?):/i.test(frame.functionName)
      ? '<path-named function>'
      : frame.functionName || '(anonymous)'
    const line = frame.lineNumber < 0 ? null : frame.lineNumber + 1
    const column = frame.columnNumber < 0 ? null : frame.columnNumber + 1
    const functionKey = JSON.stringify([location.module, functionName, line, column])
    modules.set(location.module, modules.get(location.module) ?? { ...location, selfSamples: 0, inclusiveSamples: 0 })
    functions.set(functionKey, functions.get(functionKey) ?? {
      ...location,
      method: `${functionName} @ ${location.module}:${line ?? '?'}:${column ?? '?'}`,
      functionName,
      url: location.module,
      line,
      column,
      selfSamples: 0,
      inclusiveSamples: 0,
    })
    locations.set(node.id, { module: location.module, functionKey })
  }
  for (const sample of samples) {
    const leaf = locations.get(sample)!
    modules.get(leaf.module)!.selfSamples++
    functions.get(leaf.functionKey)!.selfSamples++
    const seenModules = new Set<string>()
    const seenFunctions = new Set<string>()
    let id: number | undefined = sample
    while (id !== undefined) {
      const location = locations.get(id)!
      if (!seenModules.has(location.module)) {
        modules.get(location.module)!.inclusiveSamples++
        seenModules.add(location.module)
      }
      if (!seenFunctions.has(location.functionKey)) {
        functions.get(location.functionKey)!.inclusiveSamples++
        seenFunctions.add(location.functionKey)
      }
      id = parents.get(id)
    }
  }
  const totalSamples = samples.length
  const rankedFunctions = [...functions.values()]
    .map(entry => ({ ...entry, ...sampleCounts(entry, totalSamples) }))
    .sort((a, b) => b.selfSamples - a.selfSamples || a.method.localeCompare(b.method))
  return {
    totalSamples,
    modules: [...modules.values()].map(entry => ({
      ...entry,
      ...sampleCounts(entry, totalSamples),
      topFunctions: rankedFunctions.filter(fn => fn.module === entry.module).slice(0, 20),
    })).sort((a, b) => b.selfSamples - a.selfSamples || a.module.localeCompare(b.module)),
    topFunctions: rankedFunctions.slice(0, 20),
  }
}
