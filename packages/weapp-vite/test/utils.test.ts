import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { diff } from 'just-diff'
import path from 'pathe'
import { getProjectConfig } from '@/utils'
import { absDirs, createTempFixtureProject } from './utils'

describe('utils', () => {
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
