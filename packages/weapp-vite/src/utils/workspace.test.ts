import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveRepoRoot, resolveWorkspaceNodeModulesDir } from './workspace'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('utils/workspace', () => {
  it('resolves the nearest repo root from a package directory', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-workspace-'))
    tempDirs.push(tempDir)

    const repoRoot = path.join(tempDir, 'repo')
    const packageDir = path.join(repoRoot, 'packages/weapp-vite/scripts')
    await mkdir(packageDir, { recursive: true })
    await writeFile(path.join(repoRoot, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n', 'utf8')

    expect(resolveRepoRoot(packageDir)).toBe(repoRoot)
  })

  it('resolves workspace node_modules outside a nested worktree repo', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-worktree-'))
    tempDirs.push(tempDir)

    const workspaceRoot = path.join(tempDir, 'workspace')
    const nodeModulesDir = path.join(workspaceRoot, 'node_modules')
    const worktreeRepo = path.join(workspaceRoot, '.codex-tmp/issue-427')
    const packageDir = path.join(worktreeRepo, 'packages/weapp-vite/scripts')

    await mkdir(nodeModulesDir, { recursive: true })
    await mkdir(packageDir, { recursive: true })
    await writeFile(path.join(nodeModulesDir, '.modules.yaml'), 'layoutVersion: 9\n', 'utf8')
    await writeFile(path.join(worktreeRepo, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n', 'utf8')

    expect(resolveRepoRoot(packageDir)).toBe(worktreeRepo)
    expect(resolveWorkspaceNodeModulesDir(packageDir)).toBe(nodeModulesDir)
  })
})
