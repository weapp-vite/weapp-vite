import type { GithubIssuesBuildCaseContext } from './types'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../../../utils/buildLog'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #1013: reports unsupported dynamic directive names through the build logger', async () => {
    const issueDistRoot = path.join(context.appRoot, 'dist-issue-1013')
    const stdoutSpy = vi.spyOn(process.stdout, 'write')
    let output = ''
    let warningCount = 0
    let errorCount = 0

    try {
      const stats = await runWeappViteBuildWithLogCapture({
        cliPath: context.cliPath,
        configFile: path.join(import.meta.dirname, 'issue1013.config.ts'),
        projectRoot: context.appRoot,
        platform: 'weapp',
        cwd: context.appRoot,
        label: 'ci:github-issues:issue1013',
        outDir: 'dist-issue-1013',
        env: {
          CI: 'true',
          WEAPP_VITE_E2E_TARGET_FILE: 'e2e/ide/github-issues.runtime.issue1013.test.ts',
        },
      })
      output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('')
      warningCount = stats.warn
      errorCount = stats.error
    }
    finally {
      stdoutSpy.mockRestore()
    }

    expect(errorCount).toBe(0)
    expect(warningCount).toBeGreaterThanOrEqual(2)
    const warnings = output.split(/\r?\n/).filter(line => line.includes('[warn]'))
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('v-bind'),
      expect.stringContaining('v-on'),
    ]))

    const wxml = await fs.readFile(path.join(issueDistRoot, 'pages/issue-1013/index.wxml'), 'utf8')
    expect(wxml).not.toMatch(/\sattr=/)
    expect(wxml).not.toContain('bindevent=')
    expect(wxml).toContain('data-title="{{staticTitle}}"')
    expect(wxml).toContain('bindtap="__weapp_vite_inline"')
    expect(wxml).toContain('bindready="__weapp_vite_inline"')
  })
}
