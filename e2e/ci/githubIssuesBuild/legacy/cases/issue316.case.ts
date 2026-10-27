import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 77

export function registerGithubIssuesBuildCase() {
  it('issue #316: compiles kebab-case component events to colon-prefixed bindings', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-316/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-316/index.js')
    const emitterWxmlPath = path.join(DIST_ROOT, 'components/issue-316/HyphenEventEmitter/index.wxml')
    const emitterJsPath = path.join(DIST_ROOT, 'components/issue-316/HyphenEventEmitter/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const emitterWxml = await fs.readFile(emitterWxmlPath, 'utf-8')
    const emitterJs = await fs.readFile(emitterJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-316 hyphen event binding')
    expect(issuePageWxml).toContain('custom component event: overlay-click')
    expect(issuePageWxml).toContain('bind:overlay-click="__weapp_vite_inline"')
    expect(issuePageWxml).toContain('data-wd-overlay-click="1"')
    expect(issuePageWxml).toContain('data-wi-overlay-click="i0"')
    expect(issuePageWxml).toContain('data-overlay-count="{{overlayClickCount}}"')
    expect(issuePageWxml).not.toContain('bindoverlay-click=')
    expect(issuePageJs).toContain('handleOverlayClick')
    expect(issuePageJs).toContain('_runE2E')

    expect(emitterWxml).toContain('issue316-emitter-btn')
    expect(emitterWxml).toContain('bindtap="__weapp_vite_inline"')
    expect(emitterWxml).toContain('data-wi-tap=')
    expect(emitterJs).toContain('emitOverlayClick')
  })
}
