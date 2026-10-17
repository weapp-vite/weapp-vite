import path from 'node:path'
import { glob } from 'tinyglobby'
import { describe, expect, it, vi } from 'vitest'

interface ProjectDiscoveryConfig {
  root: string
  test: {
    include: string[]
    coverage: {
      include: string[]
      exclude: string[]
    }
  }
}

describe('web APIs test project discovery', () => {
  it('discovers every test and coverage source when paths use Windows separators', async () => {
    const packageDir = path.resolve(import.meta.dirname, '../packages-runtime/web-apis')
    vi.resetModules()
    vi.doMock('node:path', () => ({
      ...path,
      default: { ...path, join: path.win32.join },
      join: path.win32.join,
    }))

    try {
      const { default: project } = await vi.importActual<{ default: ProjectDiscoveryConfig }>(
        '../packages-runtime/web-apis/vitest.config',
      )
      expect(project.root).toBe(packageDir)
      const test = project.test
      const expectedTests = await glob(['src/**/*.test.ts', 'test/**/*.test.ts'], {
        cwd: packageDir,
        absolute: true,
      })
      expect(expectedTests.length).toBeGreaterThan(0)
      expect((await glob(test.include, { cwd: project.root, absolute: true })).sort())
        .toEqual(expectedTests.sort())

      const coverage = test.coverage
      const expectedSources = await glob('src/**/*.ts', {
        cwd: project.root,
        absolute: true,
        ignore: ['**/*.test.ts'],
      })
      expect(expectedSources.length).toBeGreaterThan(0)
      expect((await glob(coverage.include, {
        cwd: packageDir,
        absolute: true,
        ignore: coverage.exclude,
      })).sort()).toEqual(expectedSources.sort())
    }
    finally {
      vi.doUnmock('node:path')
      vi.resetModules()
    }
  })
})
