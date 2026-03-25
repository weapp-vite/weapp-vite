import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
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
}

async function inspectTsconfigPathsState(
  filePath: string,
  visited: Set<string>,
): Promise<{ root: boolean, references: boolean }> {
  if (visited.has(filePath)) {
    return {
      root: false,
      references: false,
    }
  }
  visited.add(filePath)

  if (!await fs.pathExists(filePath)) {
    return {
      root: false,
      references: false,
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
    }
  }

  const compilerOptions = parsed?.compilerOptions
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
  }

  return {
    root,
    references,
  }
}

export async function inspectTsconfigPathsUsage(cwd: string): Promise<TsconfigPathsUsage> {
  const candidates = [
    path.resolve(cwd, 'tsconfig.json'),
    path.resolve(cwd, 'jsconfig.json'),
  ]

  let root = false
  let references = false

  for (const filePath of candidates) {
    const state = await inspectTsconfigPathsState(filePath, new Set())
    root = root || state.root
    references = references || state.references
  }

  return {
    enabled: root || references,
    root,
    references,
  }
}

export async function shouldEnableTsconfigPathsPlugin(cwd: string) {
  const usage = await inspectTsconfigPathsUsage(cwd)
  return usage.enabled
}
