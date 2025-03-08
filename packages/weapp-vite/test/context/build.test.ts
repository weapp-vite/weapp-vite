import { createCompilerContext } from '@/createContext'
import { fdir } from 'fdir'
import fs from 'fs-extra'

import path from 'pathe'
import { getFixture } from '../utils'

describe('build', () => {
  const cwd = getFixture('mixjs')
  const distDir = path.resolve(cwd, 'dist')
  beforeAll(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.runProd()
    expect(await fs.exists(distDir)).toBe(true)
  })

  it('abs import src', async () => {
    expect(await fs.exists(path.resolve(distDir, 'import/a.wxml'))).toBe(true)
  })
})

describe('build basic', () => {
  const cwd = getFixture('basic')
  const distDir = path.resolve(cwd, 'dist')
  beforeAll(async () => {
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
    })
    await ctx.buildService.runProd()
    // expect(await fs.exists(distDir)).toBe(true)
  })

  it('dist', async () => {
    expect(await fs.exists(path.resolve(distDir))).toBe(true)
    // eslint-disable-next-line new-cap
    const fd = new fdir(
      {
        relativePaths: true,
      },
    )
    const files = await fd.crawl(distDir).withPromise()
    expect(files.sort()).toMatchSnapshot()
  })
})
