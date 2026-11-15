import type { GithubIssuesBuildCaseContext } from './types'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'

export const group = 'standard'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #1338: emits the Web API compatibility fixture', async () => {
    await context.runStandardBuild()
    const app = JSON.parse(await readFile(path.join(context.distRoot, 'app.json'), 'utf8')) as { pages: string[] }
    const page = 'pages/issue-1338/index'
    expect(app.pages).toContain(page)
    for (const extension of ['js', 'json', 'wxml']) {
      await expect(access(path.join(context.distRoot, `${page}.${extension}`))).resolves.toBeUndefined()
    }
    expect(await readFile(path.join(context.distRoot, `${page}.wxml`), 'utf8')).toContain('issue-1338 Web API compatibility')
  })
}
