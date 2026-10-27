import { REQUEST_GLOBAL_PRELUDE_MARKER } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 7

export function registerGithubIssuesBuildCase() {
  it('issue #764: installs axios request globals before page modules execute', async () => {
    await runBuild()

    const pageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-764/index.js'), 'utf8')
    const appPreludeJs = await fs.readFile(path.join(DIST_ROOT, 'app.prelude.js'), 'utf8')

    expect(pageJs).toContain('app.prelude.js')
    expect(appPreludeJs).toContain(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)
    expect(appPreludeJs).toContain('"fetch"')
    expect(appPreludeJs).toContain('"XMLHttpRequest"')
    expect(appPreludeJs).toContain('"URL"')
  })
}
