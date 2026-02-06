import fs from 'fs-extra'
import path from 'pathe'
import { createTestCompilerContext, getFixture, scanFiles } from './utils'

describe('lib mode', () => {
  const cwd = getFixture('lib-mode')

  async function createOutDir(name: string) {
    const outDir = path.resolve(cwd, `.tmp-${name}`)
    await fs.remove(outDir)
    return outDir
  }

  it('builds entries and auto-generates component json', async () => {
    const outDir = await createOutDir('dist')
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          outDir: path.basename(outDir),
          minify: false,
        },
      },
    })
    try {
      await ctx.buildService.build()
      const files = await scanFiles(outDir)
      const componentCases = [
        { base: 'components/button/index', hasTemplate: true, hasStyle: true },
        { base: 'components/sfc-script/index', hasTemplate: true, hasStyle: true },
        { base: 'components/sfc-setup/index', hasTemplate: true, hasStyle: true },
        { base: 'components/sfc-both/index', hasTemplate: true, hasStyle: true },
      ]

      for (const entry of componentCases) {
        expect(files).toContain(`${entry.base}.js`)
        expect(files).toContain(`${entry.base}.d.ts`)
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
        const componentJson = await fs.readJson(path.resolve(outDir, `${entry.base}.json`))
        expect(componentJson.component).toBe(true)
      }

      expect(files).toContain('utils/index.js')
      expect(files).toContain('utils/index.d.ts')
      expect(files).not.toContain('utils/index.json')
      expect(files).not.toContain('app.json')

      const buttonDts = await fs.readFile(path.resolve(outDir, 'components/button/index.d.ts'), 'utf8')
      expect(buttonDts).toContain('declare const label')
      expect(buttonDts).toContain('declare function useLabel')

      const setupDts = await fs.readFile(path.resolve(outDir, 'components/sfc-setup/index.d.ts'), 'utf8')
      expect(setupDts).not.toContain('declare const _default: any')

      const bothScript = await fs.readFile(path.resolve(outDir, 'components/sfc-both/index.js'), 'utf8')
      expect(bothScript.trim().length).toBeGreaterThan(0)

      const scriptWxss = await fs.readFile(path.resolve(outDir, 'components/sfc-script/index.wxss'), 'utf8')
      expect(scriptWxss).not.toMatch(/^[ \t]*\r?\n/)
    }
    finally {
      await fs.remove(outDir)
      await dispose()
    }
  })

  it('applies fileName override to entry outputs', async () => {
    const outDir = await createOutDir('dist-lib')
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
          outDir: path.basename(outDir),
          minify: false,
        },
      },
    })

    try {
      await ctx.buildService.build()
      const files = await scanFiles(outDir)
      expect(files).toContain('lib/button.js')
      expect(files).toContain('lib/button.d.ts')
      expect(files).toContain('lib/button.wxml')
      expect(files).toContain('lib/button.wxss')
      expect(files).toContain('lib/button.json')
      expect(files).not.toContain('components/button/index.wxml')
    }
    finally {
      await fs.remove(outDir)
      await dispose()
    }
  })

  it('can disable lib dts output', async () => {
    const outDir = await createOutDir('dist-lib-no-dts')
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        weapp: {
          lib: {
            entry: { button: 'components/button/index.ts' },
            root: 'src',
            fileName: 'lib/[name]',
            componentJson: 'auto',
            dts: false,
          },
        },
        build: {
          outDir: path.basename(outDir),
          minify: false,
        },
      },
    })

    try {
      await ctx.buildService.build()
      const files = await scanFiles(outDir)
      expect(files).toContain('lib/button.js')
      expect(files).not.toContain('lib/button.d.ts')
    }
    finally {
      await fs.remove(outDir)
      await dispose()
    }
  })
})
