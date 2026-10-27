import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue850Build } from '../build/issue850Build'
import { ISSUE_850_DIST_ROOT } from '../constants'

export const group = 'issue850'
export const order = 1

export function registerGithubIssuesBuildCase() {
  it('issue #850: processes completed independent outputs only once', async () => {
    await runIssue850Build()

    const independentStyle = await fs.readFile(
      path.join(ISSUE_850_DIST_ROOT, 'subpackages/issue-850/index.wxss'),
      'utf8',
    )
    const appJson = await fs.readJSON(path.join(ISSUE_850_DIST_ROOT, 'app.json')) as {
      subPackages?: Array<{ independent?: boolean, root?: string }>
    }

    expect(independentStyle.match(/issue-850-output-marker/g)).toHaveLength(1)
    expect(appJson.subPackages).toContainEqual(expect.objectContaining({
      independent: true,
      root: 'subpackages/issue-850',
    }))
  })
}
