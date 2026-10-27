import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { it } from 'vitest'
import { runBuildWithNodeEnv } from '../build/buildWithNodeEnv'
import { DIST_ROOT } from '../constants'
import { expectProductionEnvironment } from '../helpers'

export const group = 'issue792'
export const order = 12

export function registerGithubIssuesBuildCase() {
  it('issue #792: production build overrides an inherited development NODE_ENV', async () => {
    await runBuildWithNodeEnv('development')

    const pageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-431/index.js'), 'utf-8')

    expectProductionEnvironment(pageJs)
  })
}
