import { existsSync } from 'node:fs'
import path from 'pathe'

export function resolveRepoRoot(fromDir: string) {
  let currentDir = path.resolve(fromDir)
  while (true) {
    if (existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      return undefined
    }
    currentDir = parentDir
  }
}

export function resolveWorkspaceNodeModulesDir(fromDir: string) {
  let currentDir = path.resolve(fromDir)
  while (true) {
    const candidate = path.join(currentDir, 'node_modules')
    if (existsSync(path.join(candidate, '.modules.yaml'))) {
      return candidate
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      return undefined
    }
    currentDir = parentDir
  }
}
