import type { GithubIssuesBuildCaseContext } from './types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('feature #1087: enables required-component loading whenever the full gallery includes Skyline', async () => {
    await context.runStandardBuild()
    const app: unknown = JSON.parse(await fs.readFile(path.join(context.distRoot, 'app.json'), 'utf8'))
    const page: unknown = JSON.parse(await fs.readFile(path.join(context.distRoot, 'pages/feature-1087/skyline/index.json'), 'utf8'))
    expect(app).toMatchObject({
      pages: expect.arrayContaining(['pages/feature-1087/skyline/index']),
      lazyCodeLoading: 'requiredComponents',
    })
    expect(page).toMatchObject({ renderer: 'skyline', componentFramework: 'glass-easel' })
  })
}
