import { createCompilerContext } from '@/index'
import path from 'pathe'

describe('circularReference', () => {
  it('should throw circular reference error', async () => {
    const ctx = await createCompilerContext({
      cwd: path.resolve(__dirname, './fixtures/circularReference'),
      mode: 'development',
    })
    await ctx.buildService.build()
    console.log('circularReference build success')
  })
})
