import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompilerContext } from '@/createContext'
import { getFixture } from './utils'

const read = (file: string) => fs.readFile(file, 'utf8')

describe('subPackages shared styles', () => {
  const cwd = getFixture('subPackages-shared-styles')
  const distDir = path.resolve(cwd, 'dist')
  let ctx: Awaited<ReturnType<typeof createCompilerContext>> | undefined

  beforeAll(async () => {
    await fs.remove(distDir)
    ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
      },
    })
    await ctx.buildService.build()
  })

  afterAll(async () => {
    await ctx?.watcherService?.closeAll()
    ctx = undefined
    await fs.remove(distDir)
  })

  it('injects scoped shared imports into subpackage outputs', async () => {
    const pageStylePath = path.resolve(distDir, 'packageA/pages/foo/index.wxss')
    const pageContent = await read(pageStylePath)
    expect(pageContent).toContain('@import \'../../index.wxss\';')
    expect(pageContent).toContain('@import \'../../pages.wxss\';')
    expect(pageContent).toContain('@import \'../../styles/common.wxss\';')
    expect(pageContent).toContain('@import \'../../styles/pages.wxss\';')
    expect(pageContent).not.toContain('@import \'../../components.wxss\';')
    expect(pageContent).not.toContain('@import \'../../styles/components.wxss\';')

    const componentStylePath = path.resolve(distDir, 'packageA/components/card/index.wxss')
    const componentContent = await read(componentStylePath)
    expect(componentContent).toContain('@import \'../../index.wxss\';')
    expect(componentContent).toContain('@import \'../../components.wxss\';')
    expect(componentContent).toContain('@import \'../../styles/common.wxss\';')
    expect(componentContent).toContain('@import \'../../styles/components.wxss\';')
    expect(componentContent).not.toContain('@import \'../../pages.wxss\';')
    expect(componentContent).not.toContain('@import \'../../styles/pages.wxss\';')
  })

  it('emits shared style entry files once', async () => {
    const commonPath = path.resolve(distDir, 'packageA/styles/common.wxss')
    const pagesPath = path.resolve(distDir, 'packageA/styles/pages.wxss')
    const componentsPath = path.resolve(distDir, 'packageA/styles/components.wxss')
    const rootIndexPath = path.resolve(distDir, 'packageA/index.wxss')
    const rootPagesPath = path.resolve(distDir, 'packageA/pages.wxss')
    const rootComponentsPath = path.resolve(distDir, 'packageA/components.wxss')

    expect(await fs.exists(commonPath)).toBe(true)
    expect(await fs.exists(pagesPath)).toBe(true)
    expect(await fs.exists(componentsPath)).toBe(true)
    expect(await fs.exists(rootIndexPath)).toBe(true)
    expect(await fs.exists(rootPagesPath)).toBe(true)
    expect(await fs.exists(rootComponentsPath)).toBe(true)

    const [commonContent, pagesContent, componentsContent, rootIndexContent, rootPagesContent, rootComponentsContent] = await Promise.all([
      read(commonPath),
      read(pagesPath),
      read(componentsPath),
      read(rootIndexPath),
      read(rootPagesPath),
      read(rootComponentsPath),
    ])

    expect(commonContent.trim()).toBe('.package-common {\n  font-size: 16px;\n}')
    expect(pagesContent.trim()).toBe('.page-scope {\n  background: pink;\n}')
    expect(componentsContent.trim()).toBe('.component-theme {\n  color: royalblue;\n}')
    expect(rootIndexContent.trim()).toBe('.package-root {\n  padding: 12px;\n}')
    expect(rootPagesContent.trim()).toBe('.package-pages {\n  background: rgba(255, 192, 203, 0.3);\n}')
    expect(rootComponentsContent.trim()).toBe('.package-components {\n  border: 1px dashed #999;\n}')
  })

  it('keeps main package styles untouched', async () => {
    const mainStylePath = path.resolve(distDir, 'pages/index/index.wxss')
    const content = await read(mainStylePath)
    expect(content).not.toContain('@import')
  })
})
