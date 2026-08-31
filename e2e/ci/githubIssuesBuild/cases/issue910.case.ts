import type { GithubIssuesBuildCaseContext } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../../../utils/buildLog'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #910: resolves native async imports from the final hoisted chunk path', async () => {
    const issueDistRoot = path.join(context.appRoot, 'dist-issue-910')
    const configFile = path.join(import.meta.dirname, 'issue910.config.ts')

    await fs.remove(issueDistRoot)
    await runWeappViteBuildWithLogCapture({
      cliPath: context.cliPath,
      configFile,
      projectRoot: context.appRoot,
      platform: 'weapp',
      cwd: context.appRoot,
      label: 'ci:github-issues:issue910',
      outDir: 'dist-issue-910',
      skipNpm: true,
    })

    const appJs = await fs.readFile(path.join(issueDistRoot, 'app.js'), 'utf8')
    expect(appJs).toContain('require.async("./subs/page/lib.js")')
    expect(appJs).not.toContain('require.async("../subs/page/lib.js")')
    expect(await fs.pathExists(path.join(issueDistRoot, 'subs/page/lib.js'))).toBe(true)
  })
}
