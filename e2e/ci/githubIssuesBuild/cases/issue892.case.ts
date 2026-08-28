import type { GithubIssuesBuildCaseContext } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../../../utils/buildLog'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #892: preserves Sass asset URLs in production output', async () => {
    const issueDistRoot = path.join(context.appRoot, 'dist-issue-892')
    const configFile = path.join(import.meta.dirname, 'issue892.config.ts')

    await fs.remove(issueDistRoot)
    await runWeappViteBuildWithLogCapture({
      cliPath: context.cliPath,
      configFile,
      projectRoot: context.appRoot,
      platform: 'weapp',
      cwd: context.appRoot,
      label: 'ci:github-issues:issue892',
      outDir: 'dist-issue-892',
      skipNpm: true,
    })

    const style = await fs.readFile(
      path.join(issueDistRoot, 'styles/issue-892-app.wxss'),
      'utf8',
    )

    expect(style).toContain('.issue-892-unquoted')
    expect(style).toContain('.issue-892-quoted')
    expect(style).toContain('color: #2468ac;')
    expect(style).toContain('goods-1.png')
    expect(style).not.toContain('__VITE_ASSET__')
    expect(style).not.toContain('__VITE_PUBLIC_ASSET__')
  })
}
