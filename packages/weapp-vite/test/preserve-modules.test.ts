import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createTestCompilerContext, getFixture, scanFiles } from './utils'

const cwd = getFixture('shared-chunk-modes')
const preservedFiles = [
  'shared/common.js',
  'shared/inline-only.js',
  'shared/path-only.js',
  'shared/single-leaf.js',
  'shared/single.js',
  'shared/sub-only.js',
  'shared/vendor.js',
]

describe('preserve modules', () => {
  it.each(['cjs', 'esm'] as const)('keeps matched source modules as independent %s chunks', async (jsFormat) => {
    const outDir = path.resolve(cwd, `dist-preserve-${jsFormat}`)
    await fs.remove(outDir)

    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      isDev: false,
      mode: 'production',
      inlineConfig: {
        build: {
          outDir,
          minify: false,
        },
        weapp: {
          jsFormat,
          chunks: {
            preserveModules: ['shared/**'],
          },
          npm: {
            enable: false,
          },
        },
      },
    })

    try {
      await ctx.buildService.build({ skipNpm: true })

      const files = await scanFiles(outDir)
      expect(files).toEqual(expect.arrayContaining(preservedFiles))

      const pageCode = await fs.readFile(path.join(outDir, 'pages/index/index.js'), 'utf8')
      expect(pageCode).not.toContain('__SINGLE_MARKER__')
      expect(pageCode).not.toContain('__SINGLE_LEAF_MARKER__')
      expect(pageCode).toMatch(/(?:require\((['"`])\.\.\/\.\.\/shared\/single\.js\1\)|from\s+(['"`])\.\.\/\.\.\/shared\/single\.js\2)/)

      const singleCode = await fs.readFile(path.join(outDir, 'shared/single.js'), 'utf8')
      expect(singleCode).toContain('__SINGLE_MARKER__')
      expect(singleCode).not.toContain('__SINGLE_LEAF_MARKER__')
      expect(singleCode).toMatch(/(?:require\((['"`])\.\/single-leaf\.js\1\)|from\s+(['"`])\.\/single-leaf\.js\2)/)

      const leafCode = await fs.readFile(path.join(outDir, 'shared/single-leaf.js'), 'utf8')
      expect(leafCode).toContain('__SINGLE_LEAF_MARKER__')
    }
    finally {
      await dispose()
      await fs.remove(outDir)
    }
  })
})
