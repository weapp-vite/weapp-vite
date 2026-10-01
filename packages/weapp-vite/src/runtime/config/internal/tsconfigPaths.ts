import type { TsConfigJson, TsConfigJsonResolved } from 'get-tsconfig'
import fs from 'node:fs/promises'
import { parse as parseJson } from 'comment-json'
import { createPathsMatcher, parseTsconfig } from 'get-tsconfig'
import path from 'pathe'

function resolveReferencePath(baseDir: string, referencePath: string) {
  const resolved = path.resolve(baseDir, referencePath)
  if (path.extname(resolved)) {
    return resolved
  }
  return path.join(resolved, 'tsconfig.json')
}

export interface TsconfigPathsUsage {
  enabled: boolean
  root: boolean
  references: boolean
  aliases: Array<{ find: string, replacement: string }>
  referenceAliases: Array<{ find: string, replacement: string }>
}

function normalizePathAliasKey(key: string) {
  if (!key || (key.includes('*') && (!key.endsWith('/*') || key.indexOf('*') !== key.length - 1))) {
    return undefined
  }
  return key.endsWith('/*') ? key.slice(0, -2) : key
}

function extractPathAliases(filePath: string, config: TsConfigJsonResolved) {
  const aliases: Array<{ find: string, replacement: string }> = []
  const options = config?.compilerOptions
  if (!options?.paths || typeof options.paths !== 'object' || Array.isArray(options.paths)) {
    return aliases
  }
  // 保持既有无 baseUrl 时接受 src/* 写法的别名契约；继承锚点由解析器保存。
  const baseUrl = typeof options.baseUrl === 'string' ? options.baseUrl : undefined
  const paths: Record<string, string[]> = {}
  for (const [key, targets] of Object.entries(options.paths)) {
    if (!normalizePathAliasKey(key) || !Array.isArray(targets)) {
      continue
    }
    const target = targets.find((value): value is string => typeof value === 'string')
    if (!target || (target.includes('*') && (target.indexOf('*') !== target.length - 1 || (target !== '*' && !target.endsWith('/*'))))) {
      continue
    }
    paths[key] = [!baseUrl && !target.startsWith('.') && !path.isAbsolute(target) ? `./${target}` : target]
  }
  const match = createPathsMatcher({ path: filePath, config: { ...config, compilerOptions: { ...options, baseUrl, paths } } })
  for (const key of Object.keys(paths)) {
    const find = normalizePathAliasKey(key)
    const target = paths[key]?.[0]
    if (!find || !target || (target.includes('*') && target !== '*' && !target.endsWith('/*'))) {
      continue
    }
    const replacement = match?.(key.endsWith('/*') ? `${find}/` : find)[0]
    if (replacement) {
      aliases.push({ find, replacement: path.resolve(replacement) })
    }
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

  let parsed: TsConfigJsonResolved
  try {
    const local = parseJson(content) as TsConfigJson
    try {
      parsed = parseTsconfig(filePath)
    }
    catch {
      // 受管 extends 可能尚未生成；保留当前配置及 references 的既有 prepare 容错。
      parsed = local
    }
  }
  catch {
    return {
      root: false,
      references: false,
      aliases: [],
    }
  }

  const compilerOptions = parsed?.compilerOptions
  let aliases = extractPathAliases(filePath, parsed)
  const root = Boolean(compilerOptions?.paths || compilerOptions?.baseUrl)
  const baseDir = path.dirname(filePath)

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
    aliases: referenceAliases,
    referenceAliases,
  }
}

export async function shouldEnableTsconfigPathsPlugin(cwd: string) {
  const usage = await inspectTsconfigPathsUsage(cwd)
  return usage.enabled
}
