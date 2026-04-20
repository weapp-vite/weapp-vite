import { existsSync } from 'node:fs'
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
    const fixtureSource = path.resolve(__dirname, '../../../e2e-apps/github-issues')
    const tempProject = await createTempFixtureProject(fixtureSource, 'utils-tsconfig-chain')

    try {
      expect(existsSync(path.join(tempProject.tempDir, 'tsconfig.json'))).toBe(true)
      expect(existsSync(path.resolve(tempProject.tempDir, '../tsconfig.json'))).toBe(true)
    }
    finally {
      await tempProject.cleanup()
    }
  })
})
