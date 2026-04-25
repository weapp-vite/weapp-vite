/* eslint-disable e18e/ban-dependencies -- 清单回归测试需要 fast-glob 扫描 e2e/ci 用例。 */
import path from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'
import { getCiTasks } from './e2e-suite-manifest'
import { HMR_GUARD_ALL_TESTS } from './hmr-guard-manifest'

const ROOT = path.resolve(import.meta.dirname, '..')

function toPosixPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
}

describe('hmr-guard manifest', () => {
  it('tracks every ci hmr regression test that must be covered by pnpm e2e:ci', () => {
    const actualFiles = fg.sync([
      'ci/hmr-*.test.ts',
      'ci/auto-import-vue-sfc.test.ts',
      'ci/auto-routes-hmr.test.ts',
      'ci/issue-340-comment.hmr.test.ts',
      'ci/style-import-vue.test.ts',
      'ci/wevu-runtime.hmr.test.ts',
    ], {
      cwd: ROOT,
      absolute: true,
      onlyFiles: true,
    }).map(toPosixPath).sort()

    expect(HMR_GUARD_ALL_TESTS.slice().sort()).toEqual(actualFiles)
  })

  it('wires all hmr guard entrypoints into the ci suite', async () => {
    const ciTasks = await getCiTasks({ skipDiskBackedDevProbe: true })
    const labels = ciTasks.map(task => task.label)

    expect(labels).toContain('hmr-guard:full')
    expect(labels).toContain('hmr-guard:auto-import-vue-sfc')
    expect(labels).toContain('hmr-guard:auto-routes-hmr')
    expect(labels).toContain('hmr-guard:shared-chunks-auto')
  })
})
