import { access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { fs } from '@weapp-core/shared/fs'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'

function parsePackJson(stdout: string) {
  const jsonText = stdout.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/)?.[0]
  if (!jsonText) {
    throw new Error('npm pack --json 未返回任何输出')
  }
  return JSON.parse(jsonText) as Array<{
    files?: Array<{ path: string }>
  }>
}

async function findWorkspaceNodeModules(startDir: string) {
  let currentDir = startDir

  while (true) {
    const candidate = path.join(currentDir, 'node_modules', '.bin', 'tsdown')
    try {
      await access(candidate)
      return path.join(currentDir, 'node_modules')
    }
    catch {
      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) {
        throw new Error('未找到可用的 node_modules/.bin/tsdown')
      }
      currentDir = parentDir
    }
  }
}

async function createIsolatedPackageWorkspace(packageRoot: string) {
  const repoRoot = path.resolve(packageRoot, '../..')
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-pack-workspace-'))
  const tempRepoRoot = path.join(tempRoot, 'repo')
  const tempPackageRoot = path.join(tempRepoRoot, 'packages', 'weapp-vite')
  const workspaceNodeModules = await findWorkspaceNodeModules(packageRoot)

  await fs.ensureDir(path.dirname(tempPackageRoot))
  await fs.copy(packageRoot, tempPackageRoot, {
    dereference: true,
    filter: (src) => {
      const relative = path.relative(packageRoot, src).replaceAll('\\', '/')
      if (!relative) {
        return true
      }
      return !(
        relative === 'dist'
        || relative.startsWith('dist/')
        || relative === 'node_modules'
        || relative.startsWith('node_modules/')
      )
    },
  })
  await fs.copy(path.join(repoRoot, 'tsconfig.json'), path.join(tempRepoRoot, 'tsconfig.json'))
  await fs.copy(path.join(repoRoot, 'tsconfig.base.json'), path.join(tempRepoRoot, 'tsconfig.base.json'))
  await fs.symlink(workspaceNodeModules, path.join(tempRepoRoot, 'node_modules'), 'junction')

  return {
    tempRoot,
    tempPackageRoot,
  }
}

describe('weapp-vite release pack', () => {
  it('keeps @weapp-core/constants on workspace caret', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const packageJson = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }

    expect(packageJson.dependencies?.['@weapp-core/constants']).toBe('workspace:^')
  })

  it('includes packaged dist docs in npm pack output', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-pack-cache-'))
    const { tempRoot, tempPackageRoot } = await createIsolatedPackageWorkspace(packageRoot)

    try {
      await execa('pnpm', ['build'], {
        cwd: tempPackageRoot,
        env: {
          ...process.env,
          npm_config_loglevel: 'silent',
        },
      })

      const { stdout } = await execa(
        'npm',
        ['pack', '--json', '--dry-run', '.', '--cache', cacheDir],
        {
          cwd: tempPackageRoot,
          env: {
            ...process.env,
            npm_config_loglevel: 'silent',
          },
        },
      )
      const [packResult] = parsePackJson(stdout)
      const packedFiles = new Set((packResult?.files ?? []).map(file => file.path))

      expect(packedFiles.has('dist/docs/index.md')).toBe(true)
      expect(packedFiles.has('dist/docs/README.md')).toBe(true)
      expect(packedFiles.has('dist/docs/getting-started.md')).toBe(true)
      expect(packedFiles.has('dist/docs/ai-workflows.md')).toBe(true)
      expect(packedFiles.has('dist/docs/project-structure.md')).toBe(true)
      expect(packedFiles.has('dist/docs/weapp-config.md')).toBe(true)
      expect(packedFiles.has('dist/docs/wevu-authoring.md')).toBe(true)
      expect(packedFiles.has('dist/docs/vue-sfc.md')).toBe(true)
      expect(packedFiles.has('dist/docs/troubleshooting.md')).toBe(true)
      expect(packedFiles.has('dist/docs/mcp.md')).toBe(true)
      expect(packedFiles.has('dist/docs/volar.md')).toBe(true)
      expect(packedFiles.has('dist/docs/define-config-overloads.md')).toBe(true)
    }
    finally {
      await fs.remove(cacheDir)
      await fs.remove(tempRoot)
    }
  }, 300000)
})
