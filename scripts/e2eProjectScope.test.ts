import path from 'node:path'
import { globSync } from 'tinyglobby'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXCLUDED_PROJECTS_ENV, excludedE2EProjects, excludedE2ETestPatterns, isExcludedE2EProject } from './e2eProjectScope'
import { discoverWebProjects } from './web-project-matrix'

afterEach(() => vi.unstubAllEnvs())

describe('explicit E2E project scope', () => {
  it('keeps the default matrix and validates project identifiers', () => {
    expect(excludedE2EProjects('')).toEqual([])
    expect(excludedE2EProjects(' uview-plus-compat,uview-plus-compat,wot-ui-compat '))
      .toEqual(['uview-plus-compat', 'wot-ui-compat'])
    expect(() => excludedE2EProjects('../runtime')).toThrow('invalid project name')
    expect(() => excludedE2EProjects('*')).toThrow('invalid project name')
  })

  it('excludes only dedicated projects across path separators', () => {
    vi.stubEnv(EXCLUDED_PROJECTS_ENV, 'uview-plus-compat,wot-ui-compat')
    for (const label of ['ide/uview-plus-compat.runtime.test.ts', 'web-runtime/wot-ui-compat.test.ts', 'e2e-apps\\wot-ui-compat\\src']) {
      expect(isExcludedE2EProject(label), label).toBe(true)
    }
    for (const label of ['ci/platform-build.test.ts', 'ide/wevu-runtime.weapp.test.ts', 'ide/wot-ui-compatibility.test.ts']) {
      expect(isExcludedE2EProject(label), label).toBe(false)
    }
    expect(excludedE2ETestPatterns()).toContain('**/wot-ui-compat.*.test.ts')
  })

  it('filters real dedicated test filenames while retaining platform and runtime coverage', () => {
    vi.stubEnv(EXCLUDED_PROJECTS_ENV, 'uview-plus-compat,wot-ui-compat')
    const files = globSync('e2e/{ci,ide,web-runtime}/**/*.test.ts', {
      cwd: path.resolve(import.meta.dirname, '..'),
      ignore: excludedE2ETestPatterns(),
    })
    expect(files).toContain('e2e/ci/platform-build.test.ts')
    expect(files).toContain('e2e/ide/wevu-runtime.weapp.test.ts')
    expect(files).toContain('e2e/web-runtime/web-projects.test.ts')
    expect(files).not.toContain('e2e/web-runtime/wot-ui-compat.test.ts')
    expect(files).not.toContain('e2e/ide/uview-plus-compat.runtime.test.ts')
  })

  it('removes excluded projects from the shared Web build and runtime matrix', async () => {
    vi.stubEnv(EXCLUDED_PROJECTS_ENV, '')
    const baseline = await discoverWebProjects()
    vi.stubEnv(EXCLUDED_PROJECTS_ENV, 'uview-plus-compat,wot-ui-compat')
    const selected = await discoverWebProjects()
    expect(baseline.filter(project => !selected.some(item => item.id === project.id)).map(project => project.relativeRoot))
      .toEqual(['e2e-apps/uview-plus-compat', 'e2e-apps/wot-ui-compat'])
  })
})
