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
    expect(files).toContain('packageA/weapp-shared/common.js')
    expect(files).toContain('packageB/weapp-shared/common.js')
    expect(files.some(file => file.startsWith('weapp_shared_virtual/'))).toBe(false)
    expect(files).not.toContain('common.js')

    const packageAShared = await fs.readFile(path.resolve(distDir, 'packageA/weapp-shared/common.js'), 'utf8')
    const packageBShared = await fs.readFile(path.resolve(distDir, 'packageB/weapp-shared/common.js'), 'utf8')
    expect(packageAShared).toContain('hello from')
    expect(packageBShared).toContain('hello from')
  })

  it('rewrites importer chunks to use duplicated shared paths', async () => {
    const codeA = await fs.readFile(path.resolve(distDir, 'packageA/pages/foo.js'), 'utf8')
    const codeB = await fs.readFile(path.resolve(distDir, 'packageB/pages/bar.js'), 'utf8')

    expect(codeA).toMatch(/require\((['`])\.\.\/weapp-shared\/common\.js\1\)/)
    expect(codeB).toMatch(/require\((['`])\.\.\/weapp-shared\/common\.js\1\)/)
  })
})
