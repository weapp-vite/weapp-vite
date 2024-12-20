import { createCompilerContext } from '@/context'
import { omit } from 'lodash'
import path from 'pathe'

const fixturesDir = path.resolve(__dirname, '../fixtures/loadDefaultConfig')

function getFixture(dir: string) {
  return path.resolve(fixturesDir, dir)
}

describe('loadDefaultConfig', () => {
  it('compilerContext', async () => {
    const ctx = await createCompilerContext({
      cwd: getFixture('case0'),
    }, {
      loadConfig: false,
    })
    expect(omit(ctx, 'cwd')).toMatchSnapshot()
    await ctx.loadDefaultConfig()
    expect(omit(ctx, 'cwd')).toMatchSnapshot()
  })
})
