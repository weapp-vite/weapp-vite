import type { GithubIssuesBuildCaseContext } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../../../utils/buildLog'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #999: restores native async paths after minification', async () => {
    const issueDistRoot = path.join(context.appRoot, 'dist-issue-999')
    const configFile = path.join(import.meta.dirname, 'issue999.config.ts')

    await fs.remove(issueDistRoot)
    await runWeappViteBuildWithLogCapture({
      cliPath: context.cliPath,
      configFile,
      projectRoot: context.appRoot,
      platform: 'weapp',
      cwd: context.appRoot,
      label: 'ci:github-issues:issue999',
      outDir: 'dist-issue-999',
      skipNpm: true,
    })

    const pagePath = path.join(issueDistRoot, 'pages/require-async/index.js')
    const pageCode = await fs.readFile(pagePath, 'utf8')
    const normalizedPageCode = pageCode.replaceAll('`', '"')
    for (const target of ['callback', 'promise', 'import-native']) {
      expect(normalizedPageCode).toContain(`require.async("../../subpackages/require-async/${target}.js")`)
      expect(await fs.pathExists(path.join(issueDistRoot, `subpackages/require-async/${target}.js`))).toBe(true)
    }
    expect(pageCode).not.toContain('__weapp_vite_require_async_target__')
  })
}
