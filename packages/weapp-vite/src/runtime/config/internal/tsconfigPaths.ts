import fs from 'node:fs/promises'
import { parse as parseJson } from 'comment-json'
import path from 'pathe'

const PATHS_RE = /"paths"\s*:/
const BASE_URL_RE = /"baseUrl"\s*:/

function withJsonExtension(filePath: string) {
  return path.extname(filePath) ? filePath : `${filePath}.json`
}

function resolveReferencePath(baseDir: string, referencePath: string) {
  const resolved = path.resolve(baseDir, referencePath)
  if (path.extname(resolved)) {
    return resolved
  }
  return path.join(resolved, 'tsconfig.json')
}

function resolveExtendsPath(baseDir: string, extendsPath: string) {
  if (!extendsPath) {
    return undefined
  }
  if (extendsPath.startsWith('.') || path.isAbsolute(extendsPath)) {
    const resolved = path.isAbsolute(extendsPath)
      ? extendsPath
      : path.resolve(baseDir, extendsPath)
    return withJsonExtension(resolved)
  }
  return undefined
}

export interface TsconfigPathsUsage {
  enabled: boolean
  root: boolean
  references: boolean
  referenceAliases: Array<{ find: string, replacement: string }>
}

function normalizePathAliasKey(key: string) {
  if (!key || (key.includes('*') && !key.endsWith('/*'))) {
    return undefined
  }
  return key.endsWith('/*') ? key.slice(0, -2) : key
}

function normalizePathAliasTarget(target: string) {
  if (!target || (target.includes('*') && !target.endsWith('/*'))) {
    return undefined
  }
  return target.endsWith('/*') ? target.slice(0, -2) : target
}

function extractPathAliases(baseDir: string, compilerOptions: any) {
  const aliases: Array<{ find: string, replacement: string }> = []
  const paths = compilerOptions?.paths
  if (!paths || typeof paths !== 'object') {
    return aliases
  }

  for (const [key, value] of Object.entries(paths)) {
    const find = normalizePathAliasKey(key)
    const target = Array.isArray(value) ? value.find(item => typeof item === 'string') : undefined
    const normalizedTarget = typeof target === 'string' ? normalizePathAliasTarget(target) : undefined
    if (!find || !normalizedTarget) {
      continue
    }
    aliases.push({
      find,
      replacement: path.resolve(baseDir, normalizedTarget),
    })
  }

  return aliases
}

function mergeAliases(
  current: Array<{ find: string, replacement: string }>,
  incoming: Array<{ find: string, replacement: string }>,
) {
  const merged = [...current]
  for (const entry of incoming) {
    if (merged.some(existing => existing.find === entry.find)) {
      continue
    }
    merged.push(entry)
  }
  return merged
}

async function inspectTsconfigPathsState(
  filePath: string,
  visited: Set<string>,
): Promise<{
  root: boolean
  references: boolean
  aliases: Array<{ find: string, replacement: string }>
}> {
  if (visited.has(filePath)) {
    return {
      root: false,
      references: false,
      aliases: [],
    }
  }
  visited.add(filePath)

  try {
    await fs.access(filePath)
  }
  catch {
    return {
      root: false,
      references: false,
      aliases: [],
    }
  }

  let content = ''
  try {
    content = await fs.readFile(filePath, 'utf8')
  }
  catch {
    return {
      root: false,
      references: false,
      aliases: [],
    }
  }

  let parsed: any
  try {
    parsed = parseJson(content)
  }
  catch {
    return {
      root: false,
      references: false,
      aliases: [],
    }
  }

  const compilerOptions = parsed?.compilerOptions
  let aliases = extractPathAliases(path.dirname(filePath), compilerOptions)
  let root = Boolean(
    PATHS_RE.test(content)
    || BASE_URL_RE.test(content)
    || compilerOptions?.paths
    || compilerOptions?.baseUrl,
  )

  const baseDir = path.dirname(filePath)

  const extendsPath = typeof parsed?.extends === 'string'
    ? resolveExtendsPath(baseDir, parsed.extends)
    : undefined
  if (extendsPath) {
    const extendsState = await inspectTsconfigPathsState(extendsPath, visited)
    root = root || extendsState.root
    aliases = mergeAliases(aliases, extendsState.aliases)
  }

  let references = false
  const refs = Array.isArray(parsed?.references) ? parsed.references : []
  for (const ref of refs) {
    if (!ref || typeof ref !== 'object' || typeof ref.path !== 'string') {
      continue
    }
    const referenceFile = resolveReferencePath(baseDir, ref.path)
    const referenceState = await inspectTsconfigPathsState(referenceFile, visited)
    if (referenceState.root || referenceState.references) {
      references = true
    }
    aliases = mergeAliases(aliases, referenceState.aliases)
  }

  return {
    root,
    references,
    aliases,
  }
}

export async function inspectTsconfigPathsUsage(cwd: string): Promise<TsconfigPathsUsage> {
  const candidates = [
    path.resolve(cwd, 'tsconfig.json'),
    path.resolve(cwd, 'jsconfig.json'),
  ]

  let root = false
  let references = false
  let referenceAliases: Array<{ find: string, replacement: string }> = []

  for (const filePath of candidates) {
    const state = await inspectTsconfigPathsState(filePath, new Set())
    root = root || state.root
    references = references || state.references
    referenceAliases = mergeAliases(referenceAliases, state.aliases)
  }

  return {
    enabled: root || references,
    root,
    references,
    referenceAliases,
  }
}

export async function shouldEnableTsconfigPathsPlugin(cwd: string) {
  const usage = await inspectTsconfigPathsUsage(cwd)
  return usage.enabled
}
