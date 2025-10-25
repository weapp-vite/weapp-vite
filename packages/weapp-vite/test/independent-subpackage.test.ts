import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createTestCompilerContext, getFixture } from './utils'

describe('independent subpackage diagnostics', () => {
  it('surfaces the underlying rolldown error', async () => {
    const fixtureSource = getFixture('independent-subpackage')
    const tempRoot = path.resolve(fixtureSource, '..', '__temp__')
    await fs.ensureDir(tempRoot)
    const tempDir = await fs.mkdtemp(path.join(tempRoot, 'independent-subpackage-'))
    await fs.copy(fixtureSource, tempDir, { dereference: true })
    expect(await fs.pathExists(path.join(tempDir, 'src/app.json'))).toBe(true)

    const { ctx, dispose } = await createTestCompilerContext({
      cwd: tempDir,
    })

    try {
      await expect(ctx.buildService!.build()).rejects.toMatchObject({
        message: expect.stringContaining('helpers/objectWithoutProperties.js'),
      })

      ctx.watcherService?.closeAll()
    }
    finally {
      await dispose()
      await fs.remove(tempDir)
    }
  })
})
