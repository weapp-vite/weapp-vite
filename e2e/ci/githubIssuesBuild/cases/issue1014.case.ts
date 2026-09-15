import type { GithubIssuesBuildCaseContext } from './types'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../../../utils/buildLog'

const runtimeTarget = 'e2e/ide/github-issues.runtime.issue1014.test.ts'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #1014: exposes unsupported object directives as build warnings', async () => {
    const issueDistRoot = path.join(context.appRoot, 'dist-issue-1014')
    const configFile = path.join(import.meta.dirname, 'issue1014.config.ts')

    const stdoutSpy = vi.spyOn(process.stdout, 'write')
    let output = ''
    try {
      const stats = await runWeappViteBuildWithLogCapture({
        cliPath: context.cliPath,
        configFile,
        projectRoot: context.appRoot,
        platform: 'weapp',
        cwd: context.appRoot,
        label: 'ci:github-issues:issue1014',
        outDir: 'dist-issue-1014',
        skipNpm: true,
        env: {
          CI: 'true',
          WEAPP_VITE_E2E_TARGET_FILE: runtimeTarget,
        },
      })
      expect(stats.error).toBe(0)
      expect(stats.warn).toBeGreaterThanOrEqual(2)
      output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('')
    }
    finally {
      stdoutSpy.mockRestore()
    }

    const warnings = output.split(/\r?\n/).filter(line => line.includes('[warn]'))
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('v-bind'),
      expect.stringContaining('v-on'),
    ]))
    const pageRoot = path.join(issueDistRoot, 'pages/issue-1014/index')
    const template = await fs.readFile(`${pageRoot}.wxml`, 'utf8')
    expect(template).toContain('data-title="{{attrs.title}}"')
    expect(template).toContain('bindtap="__weapp_vite_inline"')
    expect(template).not.toContain('data-object=')
  })
}
