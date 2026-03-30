import { omit } from 'lodash'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import { projectFixturesDir } from '../utils'

const fixturesDir = path.resolve(projectFixturesDir, 'loadDefaultConfig')

describe.skip('loadDefaultConfig', () => {
  it('compilerContext', async () => {
    const ctx = await createCompilerContext({
      cwd: path.resolve(fixturesDir, 'case0'),
    })
    delete (ctx.configService.options as any).cwd
    delete (ctx.configService.options as any).packageJsonPath
    delete (ctx as any).cwd
    delete (ctx.npmService as any).cwd

    expect(omit(ctx, ['configService.packageInfo'])).toMatchSnapshot()
  })
})
