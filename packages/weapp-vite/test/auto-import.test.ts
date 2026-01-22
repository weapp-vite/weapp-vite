import CI from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import { getFixture, scanFiles } from './utils'

describe.skipIf(CI.isCI)('auto-import', () => {
  const fixtureSource = getFixture('auto-import')
  const tempRoot = path.resolve(fixtureSource, '..', '__temp__')
  let tempDir = ''
  let distDir = ''

  beforeAll(async () => {
    await fs.ensureDir(tempRoot)
    tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-build-'))
    await fs.copy(fixtureSource, tempDir, {
      dereference: true,
      filter: (src) => {
        const relative = path.relative(fixtureSource, src).replaceAll('\\', '/')
        if (!relative) {
          return true
        }
        return !(relative === 'dist' || relative.startsWith('dist/'))
      },
    })
    distDir = path.resolve(tempDir, 'dist')
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd: tempDir,
    })
    await ctx.buildService.build()
    expect(await fs.exists(distDir)).toBe(true)
  })

  afterAll(async () => {
    if (tempDir) {
      await fs.remove(tempDir)
      if (await fs.pathExists(tempRoot)) {
        const remaining = await fs.readdir(tempRoot)
        if (remaining.length === 0) {
          await fs.remove(tempRoot)
        }
      }
    }
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
