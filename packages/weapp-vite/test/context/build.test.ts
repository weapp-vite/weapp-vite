import { createCompilerContext } from '@/context'
// import { omit } from 'lodash'

import { getFixture } from '../utils'

describe('build', () => {
  it('compilerContext', async () => {
    const ctx = await createCompilerContext({
      cwd: getFixture('mixjs'),
    }, {
      loadConfig: false,
    })
    // expect(omit(ctx, 'cwd')).matchSnapshot()
    await ctx.loadDefaultConfig()
    // expect(omit(ctx, 'cwd')).matchSnapshot()
    await ctx.runProd()
  })
})
