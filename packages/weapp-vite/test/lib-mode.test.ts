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
      expect(files).toContain('components/button/index.js')
      expect(files).toContain('components/button/index.wxml')
      expect(files).toContain('components/button/index.wxss')
      expect(files).toContain('components/button/index.json')
      expect(files).toContain('utils/index.js')
      expect(files).not.toContain('utils/index.json')
      expect(files).not.toContain('app.json')

      const buttonJson = await fs.readJson(path.resolve(distDir, 'components/button/index.json'))
      expect(buttonJson.component).toBe(true)
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
