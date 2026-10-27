import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 67

export function registerGithubIssuesBuildCase() {
  it('issue #418/#419: keeps native template refs stable for third-party components', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-418-419/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-418-419/index.js')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-418-419/index.json')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageJson = await fs.readFile(pageJsonPath, 'utf-8')

    expect(pageWxml).toContain('issue-418-419 template ref native component')
    expect(pageWxml).toContain('<native-ref-probe')
    expect(pageWxml).toContain('issue-418-419')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('nativeButtonRef')
    expect(pageJs).toContain('descriptorConfigurable')
    expect(pageJson).toContain('../../components/issue-418-419/NativeRefProbe/index')
  })
}
