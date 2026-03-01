import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function hasWorkspaceMarkers(dir: string) {
  return fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))
    && fs.existsSync(path.join(dir, 'package.json'))
}

export function resolveWorkspaceRoot(start = process.cwd()) {
  let current = path.resolve(start)
  while (true) {
    if (hasWorkspaceMarkers(current)) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) {
      return path.resolve(start)
    }
    current = parent
  }
}

export function assertInsideRoot(root: string, targetPath: string) {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(targetPath)
  const relative = path.relative(resolvedRoot, resolvedTarget)
  if (relative === '' || relative === '.') {
    return resolvedTarget
  }
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`路径越界：${targetPath}`)
  }
  return resolvedTarget
}

export function resolveSubPath(root: string, relativePath: string) {
  if (!relativePath || relativePath === '.') {
    return path.resolve(root)
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error('仅支持相对路径')
  }
  return assertInsideRoot(root, path.resolve(root, relativePath))
}
