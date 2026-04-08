import { fs } from '@weapp-core/shared'
import CI from 'ci-info'
import path from 'pathe'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import { createTempFixtureProject, createTestCompilerContext, getFixture, scanFiles } from './utils'

describe.skipIf(CI.isCI)('auto-import', () => {
  const fixtureSource = getFixture('auto-import')
  let tempDir = ''
  let distDir = ''
  let cleanup: (() => Promise<void>) | undefined

  beforeAll(async () => {
    const tempProject = await createTempFixtureProject(fixtureSource, 'auto-import-build')
    tempDir = tempProject.tempDir
    cleanup = tempProject.cleanup
    distDir = path.resolve(tempDir, 'dist')
    await fs.remove(distDir)
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: tempDir,
    })
    try {
      await ctx.buildService.build()
      expect(await fs.exists(distDir)).toBe(true)
    }
    finally {
      await dispose()
    }
  })

  afterAll(async () => {
    await cleanup?.()
  })

  it('scanFiles', async () => {
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()
    const codes = await Promise.all(
      files.filter(x => x.endsWith('.json')).map((x) => {
        return fs.readFile(path.resolve(distDir, x), 'utf-8')
      }),
    )
    expect(codes).toMatchSnapshot()
    expect(wxsCodeCache.size).toBe(0)
    expect(cssCodeCache.size).toBe(8)
  })
})
