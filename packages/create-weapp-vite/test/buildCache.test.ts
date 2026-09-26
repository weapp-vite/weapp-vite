import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/fs'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'

const packageManifests = {
  'weapp-vite': 'packages/weapp-vite/package.json',
  'wevu': 'packages-runtime/wevu/package.json',
  '@weapp-vite/react': 'packages-runtime/react/package.json',
  '@weapp-vite/dashboard': 'packages/dashboard/package.json',
  '@weapp-vite/eslint': 'packages/eslint/package.json',
}

interface TurboDryRun {
  tasks: Array<{ taskId: string, hash: string }>
}

describe('create-weapp-vite build cache', () => {
  it('invalidates the build for bundled package versions and catalog changes', async () => {
    const repoRoot = path.resolve(import.meta.dirname, '../../..')
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-build-cache-'))
    const packageRoot = path.join(tempRoot, 'packages/create-weapp-vite')
    const workspacePath = path.join(tempRoot, 'pnpm-workspace.yaml')
    const workspaceConfig = 'packages:\n  - packages/*\n  - packages-runtime/*\n'

    async function buildHash() {
      const { stdout } = await execa('turbo', ['run', 'build', '--filter=create-weapp-vite', '--dry=json'], {
        cwd: tempRoot,
        preferLocal: true,
        localDir: repoRoot,
        env: { TURBO_TELEMETRY_DISABLED: '1' },
      })
      const dryRun = JSON.parse(stdout) as TurboDryRun
      const task = dryRun.tasks.find(task => task.taskId === 'create-weapp-vite#build')
      expect(task).toBeDefined()
      return task!.hash
    }

    try {
      await fs.ensureDir(packageRoot)
      await fs.writeJSON(path.join(tempRoot, 'package.json'), {
        name: 'create-weapp-vite-cache-fixture',
        private: true,
        packageManager: 'pnpm@12.5.1',
      })
      await fs.writeFile(workspacePath, workspaceConfig)
      await fs.writeFile(path.join(tempRoot, 'pnpm-lock.yaml'), 'lockfileVersion: \'9.0\'\nimporters: {}\n')
      await fs.copy(path.join(repoRoot, 'turbo.json'), path.join(tempRoot, 'turbo.json'))
      await fs.copy(path.join(repoRoot, 'packages/create-weapp-vite/turbo.json'), path.join(packageRoot, 'turbo.json'))
      await fs.writeJSON(path.join(packageRoot, 'package.json'), {
        name: 'create-weapp-vite',
        version: '1.0.0',
        scripts: { build: 'node -e "process.exit(1)"' },
      })
      await fs.outputFile(path.join(packageRoot, 'src/index.ts'), 'export const fixture = true\n')
      for (const [name, manifestPath] of Object.entries(packageManifests)) {
        await fs.outputJSON(path.join(tempRoot, manifestPath), { name, version: '1.0.0' })
      }
      await fs.outputJSON(path.join(tempRoot, 'packages/unrelated/package.json'), {
        name: 'unrelated',
        version: '1.0.0',
      })

      let previousHash = await buildHash()
      for (const [name, manifestPath] of Object.entries(packageManifests)) {
        await fs.writeJSON(path.join(tempRoot, manifestPath), { name, version: '1.0.1' })
        const nextHash = await buildHash()
        expect(nextHash, `${name} version must invalidate the bundled release snapshot`).not.toBe(previousHash)
        previousHash = nextHash
      }

      await fs.writeFile(workspacePath, `${workspaceConfig}catalog:\n  typescript: ^6.0.0\n`)
      const catalogHash = await buildHash()
      expect(catalogHash).not.toBe(previousHash)

      await fs.writeJSON(path.join(tempRoot, 'packages/unrelated/package.json'), {
        name: 'unrelated',
        version: '1.0.1',
      })
      expect(await buildHash()).toBe(catalogHash)

      await fs.writeFile(path.join(packageRoot, 'src/index.ts'), 'export const fixture = false\n')
      expect(await buildHash()).not.toBe(catalogHash)
    }
    finally {
      await fs.remove(tempRoot)
    }
  })
})
