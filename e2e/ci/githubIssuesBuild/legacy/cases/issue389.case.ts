import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 64

export function registerGithubIssuesBuildCase() {
  it('issue #389: keeps native setPageLayout off the wevu layout runtime path', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-389/index.js')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageJs).toContain('issue-389 native runtime export should stay native-only')
    expect(pageJs).toContain('__wevuSetPageLayout')
    expect(pageJs).not.toContain('__wevuPageLayoutState')
    expect(pageJs).not.toContain('usePageLayout() 必须在 setup() 的同步阶段调用')
    expect(pageJs).not.toContain('syncRuntimePageLayoutStateFromRuntime')
  })
}
