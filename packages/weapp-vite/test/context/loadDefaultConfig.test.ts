import { omit } from 'lodash'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'

const fixturesDir = path.resolve(__dirname, '../fixtures/loadDefaultConfig')

function getFixture(dir: string) {
  return path.resolve(fixturesDir, dir)
}

describe('loadDefaultConfig', () => {
  it('compilerContext', async () => {
    const ctx = await createCompilerContext({
      cwd: getFixture('case0'),
    })
    delete (ctx.configService.options as any).cwd
    delete (ctx.configService.options as any).packageJsonPath
    delete (ctx as any).cwd
    delete (ctx.npmService as any).cwd

    expect(omit(ctx, ['configService.packageInfo'])).toMatchSnapshot()
  })
})
