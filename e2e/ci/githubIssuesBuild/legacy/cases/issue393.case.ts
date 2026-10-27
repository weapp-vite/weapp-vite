import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue393Build } from '../builders/issue393Build'
import { ISSUE_393_DIST_ROOT } from '../constants'
import { scanFiles } from '../helpers'

export const group = 'issue393'
export const order = 60

export function registerGithubIssuesBuildCase() {
  it('issue #393: keeps path-mode devDependency chunks out of dist/node_modules', async () => {
    await runIssue393Build()

    const files = await scanFiles(ISSUE_393_DIST_ROOT)
    const pageJs = await fs.readFile(path.join(ISSUE_393_DIST_ROOT, 'pages/issue-393/index.js'), 'utf8')

    expect(files).toContain('pages/issue-393/index.js')
    expect(files).toContain('debounce/index.js')
    expect(files.some(file => file.startsWith('node_modules/'))).toBe(false)
    expect(pageJs).toContain('../../debounce/index.js')
  })
}
