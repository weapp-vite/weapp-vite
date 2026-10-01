import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { diff } from 'just-diff'
import path from 'pathe'
import { getProjectConfig } from '@/utils'
import { absDirs, createTempFixtureProject, ensureWorkspacePackageLink } from './utils'

describe('utils', () => {
  it.each(['shared-node-modules', 'aliased-project'])('preserves workspace package resolution through %s', async (mode) => {
    const sandboxParent = path.resolve(import.meta.dirname, '../.tmp')
    await mkdir(sandboxParent, { recursive: true })
    const sandboxRoot = await mkdtemp(path.join(sandboxParent, 'weapp-vite-link-'))
    const sharedRoot = path.join(sandboxRoot, 'shared')
    const projectRoot = path.join(sandboxRoot, 'fixtures/app')
    const modules = path.join(sharedRoot, 'node_modules')
    const packageRoot = path.join(modules, 'weapp-vite')
    const target = path.resolve(import.meta.dirname, '..')
    try {
      await mkdir(modules, { recursive: true })
      await mkdir(path.dirname(projectRoot), { recursive: true })
      await symlink(process.platform === 'win32' ? target : path.relative(modules, target), packageRoot, 'junction')
      const original = await readlink(packageRoot)
      if (mode === 'shared-node-modules') {
        await mkdir(projectRoot)
        await symlink(modules, path.join(projectRoot, 'node_modules'), 'junction')
      }
      else {
        await symlink(sharedRoot, projectRoot, 'junction')
      }
      await ensureWorkspacePackageLink(projectRoot)
      expect(await realpath(path.join(projectRoot, 'node_modules/weapp-vite'))).toBe(await realpath(target))
      expect(await readlink(packageRoot)).toBe(original)
      await ensureWorkspacePackageLink(projectRoot)
      expect(await readlink(packageRoot)).toBe(original)
    }
    finally {
      await rm(sandboxRoot, { recursive: true, force: true })
    }
  })

  describe('getProjectConfig', () => {
    it.each(absDirs)('$name', async ({ path: p }) => {
      expect(diff(
        await getProjectConfig(p, { ignorePrivate: true }),
        await getProjectConfig(p),
      )).toMatchSnapshot()
    })
  })

  it('preserves external tsconfig extends targets for temp fixtures', async () => {
    const sandboxRoot = await mkdtemp(path.join(tmpdir(), 'weapp-vite-utils-'))
    const fixtureParent = path.join(sandboxRoot, 'fixtures')
    const fixtureSource = path.join(fixtureParent, 'app')

    await mkdir(fixtureSource, { recursive: true })
    await writeFile(path.join(fixtureParent, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
      },
    }, null, 2))
    await writeFile(path.join(fixtureSource, 'tsconfig.json'), JSON.stringify({
      extends: '../tsconfig.json',
    }, null, 2))

    const tempProject = await createTempFixtureProject(fixtureSource, 'utils-tsconfig-chain')

    try {
      expect(existsSync(path.join(tempProject.tempDir, 'tsconfig.json'))).toBe(true)
      expect(existsSync(path.resolve(tempProject.tempDir, '../tsconfig.json'))).toBe(true)
    }
    finally {
      await tempProject.cleanup()
      await rm(sandboxRoot, { recursive: true, force: true })
    }
  })
})
