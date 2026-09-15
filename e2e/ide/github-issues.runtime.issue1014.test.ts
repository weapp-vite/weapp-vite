import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
} from './github-issues.runtime.shared'
import { runGithubDom } from './githubIssuesDom'
import { OBJECT_DIRECTIVE_CONTROLS } from './githubIssuesDom/objectDirectives'

const route = '/pages/issue-1014/index'

describe('e2e app: github-issues / issue #1014', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('reports unsupported object directives while explicit attributes and events keep working', async (ctx) => {
    const pageRoot = path.join(DIST_ROOT, 'pages/issue-1014/index')
    const [script, template, config, style] = await Promise.all(
      ['js', 'wxml', 'json', 'wxss'].map(extension => fs.readFile(`${pageRoot}.${extension}`, 'utf8')),
    )

    expect(script.trim()).not.toBe('')
    expect(template.trim()).not.toBe('')
    expect(config.trim()).not.toBe('')
    expect(style.trim()).not.toBe('')
    expect(template).toContain('issue 1014 object directives')
    expect(template).toContain('data-title="{{attrs.title}}"')
    expect(template).toContain('bindtap="__weapp_vite_inline"')
    expect(template).not.toContain('data-object=')

    await runGithubDom(ctx, route, OBJECT_DIRECTIVE_CONTROLS)
  })
})
