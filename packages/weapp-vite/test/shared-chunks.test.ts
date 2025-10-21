import type { CompilerContext } from '@/context'
import fs from 'fs-extra'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import { getFixture, scanFiles } from './utils'

describe('shared chunks duplication strategy', () => {
  const cwd = getFixture('shared-chunks')
  const distDir = path.resolve(cwd, 'dist')
  let ctx: CompilerContext

  beforeAll(async () => {
    await fs.remove(distDir)
    ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.build()
  })

  afterAll(async () => {
    if (ctx?.watcherService) {
      await ctx.watcherService.closeAll()
    }
  })

  it('emits shared chunks for each sub-package by default', async () => {
    const files = await scanFiles(distDir)
    expect(files).toContain('packageA/__shared__/common.js')
    expect(files).toContain('packageB/__shared__/common.js')
    expect(files.some(file => file.startsWith('__weapp_shared__'))).toBe(true)
    expect(files).not.toContain('common.js')

    const sharedChunkPath = path.resolve(distDir, '__weapp_shared__/packageA_packageB/common.js')
    expect(await fs.readFile(sharedChunkPath, 'utf8')).toContain('duplicated into sub-packages')
  })

  it('rewrites importer chunks to use duplicated shared paths', async () => {
    const codeA = await fs.readFile(path.resolve(distDir, 'packageA/pages/foo.js'), 'utf8')
    const codeB = await fs.readFile(path.resolve(distDir, 'packageB/pages/bar.js'), 'utf8')

    expect(codeA).toMatch(/require\((['`])\.\.\/__shared__\/common\.js\1\)/)
    expect(codeB).toMatch(/require\((['`])\.\.\/__shared__\/common\.js\1\)/)
  })
})
