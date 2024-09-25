import { CompilerContext } from '@/context'
import { omit } from 'lodash'

import { getFixture } from '../utils'

describe('build', () => {
  it('compilerContext', async () => {
    const ctx = new CompilerContext({
      cwd: getFixture('mixjs'),
    })
    expect(omit(ctx, 'cwd')).matchSnapshot()
    await ctx.loadDefaultConfig()
    expect(omit(ctx, 'cwd')).matchSnapshot()
    await ctx.runProd()
  })
})
