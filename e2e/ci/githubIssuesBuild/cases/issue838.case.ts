import type { GithubIssuesBuildCaseContext } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../../../utils/buildLog'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('PR #838: injects explicitly included shared styles into app.vue', async () => {
    const issueDistRoot = path.join(context.appRoot, 'dist-issue-838')
    const configFile = path.join(import.meta.dirname, 'issue838.config.ts')

    await fs.remove(issueDistRoot)
    await runWeappViteBuildWithLogCapture({
      cliPath: context.cliPath,
      configFile,
      projectRoot: context.appRoot,
      platform: 'weapp',
      cwd: context.appRoot,
      label: 'ci:github-issues:issue838',
      outDir: 'dist-issue-838',
      skipNpm: true,
    })

    const appStyle = await fs.readFile(path.join(issueDistRoot, 'app.wxss'), 'utf8')
    const sharedStyle = await fs.readFile(
      path.join(issueDistRoot, 'styles/issue-838-app-vue.wxss'),
      'utf8',
    )

    expect(appStyle).toContain('@import \'./styles/issue-838-app-vue.wxss\';')
    expect(sharedStyle).toContain('color: #123456;')
  })
}
