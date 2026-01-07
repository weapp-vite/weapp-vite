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

async function hasTsconfigPaths(filePath: string, visited: Set<string>): Promise<boolean> {
  if (visited.has(filePath)) {
    return false
  }
  visited.add(filePath)

  if (!await fs.pathExists(filePath)) {
    return false
  }

  let content = ''
  try {
    content = await fs.readFile(filePath, 'utf8')
  }
  catch {
    return false
  }

  if (PATHS_RE.test(content) || BASE_URL_RE.test(content)) {
    return true
  }

  let parsed: any
  try {
    parsed = parseJson(content)
  }
  catch {
    return false
  }

  const compilerOptions = parsed?.compilerOptions
  if (compilerOptions?.paths || compilerOptions?.baseUrl) {
    return true
  }

  const baseDir = path.dirname(filePath)

  const extendsPath = typeof parsed?.extends === 'string'
    ? resolveExtendsPath(baseDir, parsed.extends)
    : undefined
  if (extendsPath && await hasTsconfigPaths(extendsPath, visited)) {
    return true
  }

  const references = Array.isArray(parsed?.references) ? parsed.references : []
  for (const ref of references) {
    if (!ref || typeof ref !== 'object' || typeof ref.path !== 'string') {
      continue
    }
    const referenceFile = resolveReferencePath(baseDir, ref.path)
    if (await hasTsconfigPaths(referenceFile, visited)) {
      return true
    }
  }

  return false
}

export async function shouldEnableTsconfigPathsPlugin(cwd: string) {
  const candidates = [
    path.resolve(cwd, 'tsconfig.json'),
    path.resolve(cwd, 'jsconfig.json'),
  ]
  for (const filePath of candidates) {
    if (await hasTsconfigPaths(filePath, new Set())) {
      return true
    }
  }
  return false
}
