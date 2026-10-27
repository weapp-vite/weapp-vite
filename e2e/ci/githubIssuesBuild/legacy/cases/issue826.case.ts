import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue826Build } from '../builders/issue826Build'
import { issue826DistRoot } from '../constants'
import { scanFiles } from '../helpers'

export const group = 'issue826'
export const order = 3

export function registerGithubIssuesBuildCase() {
  it('issue #826: preserves configured source module paths for debugging', async () => {
    for (const jsFormat of ['cjs', 'esm'] as const) {
      await runIssue826Build(jsFormat)
      const distRoot = issue826DistRoot(jsFormat)

      const files = await scanFiles(distRoot)
      expect(files).toEqual(expect.arrayContaining([
        'issue-fixtures/issue-826/services/shared.js',
        'issue-fixtures/issue-826/services/single.js',
        'issue-fixtures/issue-826/utils/barrel.js',
        'issue-fixtures/issue-826/utils/leafA.js',
        'issue-fixtures/issue-826/utils/leafB.js',
        'issue-fixtures/issue-826/utils/shared.js',
        'issue-fixtures/issue-826/utils/single.js',
      ]))
      expect(files).not.toContain('pages/issue-826/local.js')

      const pageCode = await fs.readFile(path.join(distRoot, 'pages/issue-826/index.js'), 'utf8')
      expect(pageCode).toContain('__ISSUE_826_LOCAL_UNMATCHED__')
      expect(pageCode).not.toContain('__ISSUE_826_UTIL_SINGLE__')
      expect(pageCode).not.toContain('__ISSUE_826_SERVICE_SINGLE__')
      expect(pageCode).toMatch(/issue-fixtures\/issue-826\/utils\/single\.js/)
      expect(pageCode).toMatch(/issue-fixtures\/issue-826\/services\/single\.js/)

      const barrelCode = await fs.readFile(path.join(distRoot, 'issue-fixtures/issue-826/utils/barrel.js'), 'utf8')
      expect(barrelCode).not.toContain('__ISSUE_826_UTIL_LEAF_A__')
      expect(barrelCode).not.toContain('__ISSUE_826_UTIL_LEAF_B__')
      expect(barrelCode).toMatch(/(?:require\((['"`])\.\/leafA\.js\1\)|from\s+(['"`])\.\/leafA\.js\2)/)
      expect(barrelCode).toMatch(/(?:require\((['"`])\.\/leafB\.js\1\)|from\s+(['"`])\.\/leafB\.js\2)/)

      const secondPageCode = await fs.readFile(path.join(distRoot, 'pages/issue-826/second.js'), 'utf8')
      expect(secondPageCode).not.toContain('__ISSUE_826_UTIL_SHARED__')
      expect(secondPageCode).toMatch(/issue-fixtures\/issue-826\/utils\/shared\.js/)
      await fs.remove(distRoot)
    }
  })
}
