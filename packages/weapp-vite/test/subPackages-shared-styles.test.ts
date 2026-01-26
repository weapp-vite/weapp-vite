import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCompilerContext } from '@/createContext'
import { getFixture } from './utils'

const read = (file: string) => fs.readFile(file, 'utf8')
const normalizeEol = (value: string) => value.replace(/\r\n/g, '\n')

describe('subPackages shared styles', () => {
  const cwd = getFixture('subPackages-shared-styles')
  const distDir = path.resolve(cwd, 'dist')
  const artifactDir = path.resolve(cwd, 'dist-generated')
  let ctx: Awaited<ReturnType<typeof createCompilerContext>> | undefined

  beforeAll(async () => {
    await Promise.all([
      fs.remove(distDir),
      fs.remove(artifactDir),
    ])
    ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
      },
    })
    await ctx.buildService.build()
    await fs.copy(distDir, artifactDir)
  }, 60000)

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
    const formsPath = path.resolve(distDir, 'packageA/styles/forms.wxss')
    const componentsPath = path.resolve(distDir, 'packageA/styles/components.wxss')
    const rootIndexPath = path.resolve(distDir, 'packageA/index.wxss')
    const rootPagesPath = path.resolve(distDir, 'packageA/pages.wxss')
    const rootComponentsPath = path.resolve(distDir, 'packageA/components.wxss')

    expect(await fs.exists(commonPath)).toBe(true)
    expect(await fs.exists(pagesPath)).toBe(true)
    expect(await fs.exists(formsPath)).toBe(true)
    expect(await fs.exists(componentsPath)).toBe(true)
    expect(await fs.exists(rootIndexPath)).toBe(true)
    expect(await fs.exists(rootPagesPath)).toBe(true)
    expect(await fs.exists(rootComponentsPath)).toBe(true)

    const [commonContent, pagesContent, formsContent, componentsContent, rootIndexContent, rootPagesContent, rootComponentsContent] = await Promise.all([
      read(commonPath),
      read(pagesPath),
      read(formsPath),
      read(componentsPath),
      read(rootIndexPath),
      read(rootPagesPath),
      read(rootComponentsPath),
    ])

    expect(normalizeEol(commonContent).trim()).toBe('.package-common {\n  font-size: 16px;\n}')
    expect(pagesContent).toContain('background: linear-gradient(135deg, #ff9ec7 0%, #f96fa3 100%);')
    expect(pagesContent).toContain('box-shadow: 0 16px 32px rgba(58, 26, 45, 0.24);')
    expect(pagesContent).toContain('content: "[page]";')
    expect(pagesContent).toMatch(/\.page-ribbon--hero \{/)
    expect(pagesContent).toMatch(/\.page-ribbon--accent \{/)
    expect(pagesContent).toMatch(/\.page-ribbon--subtle \{/)

    expect(formsContent).toContain('.forms-scope {')
    expect(formsContent).toContain('display: flex;')
    expect(formsContent).toMatch(/\.forms-scope__input \{/)
    expect(formsContent).toContain('text-transform: uppercase;')
    const outlines = formsContent.match(/outline: 2px solid rgba\(/g) ?? []
    expect(outlines.length).toBeGreaterThanOrEqual(3)

    expect(componentsContent).toContain('background: linear-gradient(145deg, rgba(65, 105, 225, 0.16), rgba(255, 255, 255, 0.55));')
    expect(componentsContent).toContain('box-shadow: 0 8px 24px rgba(65, 105, 225, 0.28);')
    expect(componentsContent).toMatch(/\.component-theme--primary \{/)
    expect(componentsContent).toMatch(/\.component-theme--muted \{/)
    expect(componentsContent).toContain('border-style: dashed;')
    expect(componentsContent).toMatch(/\.component-theme--warning \{/)

    expect(normalizeEol(rootIndexContent).trim()).toBe('.package-root {\n  padding: 12px;\n}')
    expect(normalizeEol(rootPagesContent).trim()).toBe('.package-pages {\n  background: rgba(255, 192, 203, 0.3);\n}')
    expect(normalizeEol(rootComponentsContent).trim()).toBe('.package-components {\n  border: 1px dashed #999;\n}')
  })

  it('keeps main package styles untouched', async () => {
    const mainStylePath = path.resolve(distDir, 'pages/index/index.wxss')
    const content = await read(mainStylePath)
    expect(content).not.toContain('@import')
  })
})
