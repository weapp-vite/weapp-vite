import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'
import { createSerializedJsonEntryPattern } from '../helpers'

export const group = 'standard'
export const order = 36

export function registerGithubIssuesBuildCase() {
  it('issue #484: keeps config.define import.meta.env member overrides in weapp-vite preprocessed files', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-484/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-484/index.js')
    const helperJsPath = path.join(DIST_ROOT, 'pages/issue-484/define.js')
    const issuePageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const helperJs = await fs.pathExists(helperJsPath)
      ? await fs.readFile(helperJsPath, 'utf-8')
      : pageJs

    expect(issuePageWxml).toContain('issue-484 import.meta.env define override')
    expect(pageJs).toContain('var pageDefinedFlag = 123456;')
    expect(pageJs).toContain('const pageSummary = `issue-484 page define:')
    expect(pageJs).toMatch(createSerializedJsonEntryPattern('MODE', 'production'))
    expect(pageJs).not.toContain('ISSUE_484_FLAG')
    expect(helperJs).toContain('var helperDefinedFlag = 123456;')
    expect(helperJs).toContain('helperSummary = `issue-484 helper define:')
    expect(helperJs).toMatch(createSerializedJsonEntryPattern('MODE', 'production'))
    expect(helperJs).not.toContain('ISSUE_484_FLAG')
  })
}
