import fs from 'fs-extra'
import path from 'pathe'
import { createTestCompilerContext, getFixture, scanFiles } from './utils'

describe('lib mode', () => {
  const cwd = getFixture('lib-mode')
  const distDir = path.resolve(cwd, 'dist')

  it('builds entries and auto-generates component json', async () => {
    await fs.remove(distDir)
    const { ctx, dispose } = await createTestCompilerContext({ cwd })
    try {
      await ctx.buildService.build()
      const files = await scanFiles(distDir)
      const componentCases = [
        { base: 'components/button/index', hasTemplate: true, hasStyle: true },
        { base: 'components/sfc-script/index', hasTemplate: true, hasStyle: false },
        { base: 'components/sfc-setup/index', hasTemplate: false, hasStyle: true },
        { base: 'components/sfc-both/index', hasTemplate: true, hasStyle: true },
      ]

      for (const entry of componentCases) {
        expect(files).toContain(`${entry.base}.js`)
        expect(files).toContain(`${entry.base}.json`)
        if (entry.hasTemplate) {
          expect(files).toContain(`${entry.base}.wxml`)
        }
        else {
          expect(files).not.toContain(`${entry.base}.wxml`)
        }
        if (entry.hasStyle) {
          expect(files).toContain(`${entry.base}.wxss`)
        }
        else {
          expect(files).not.toContain(`${entry.base}.wxss`)
        }
        const componentJson = await fs.readJson(path.resolve(distDir, `${entry.base}.json`))
        expect(componentJson.component).toBe(true)
      }

      expect(files).toContain('utils/index.js')
      expect(files).not.toContain('utils/index.json')
      expect(files).not.toContain('app.json')

    }
    finally {
      await dispose()
    }
  })

  it('applies fileName override to entry outputs', async () => {
    const outDir = path.resolve(cwd, 'dist-lib')
    await fs.remove(outDir)
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        weapp: {
          lib: {
            entry: { button: 'components/button/index.ts' },
            root: 'src',
            fileName: 'lib/[name]',
            componentJson: 'auto',
          },
        },
        build: {
          outDir: 'dist-lib',
          minify: false,
        },
      },
    })

    try {
      await ctx.buildService.build()
      const files = await scanFiles(outDir)
      expect(files).toContain('lib/button.js')
      expect(files).toContain('lib/button.wxml')
      expect(files).toContain('lib/button.wxss')
      expect(files).toContain('lib/button.json')
      expect(files).not.toContain('components/button/index.wxml')
    }
    finally {
      await dispose()
    }
  })
})
