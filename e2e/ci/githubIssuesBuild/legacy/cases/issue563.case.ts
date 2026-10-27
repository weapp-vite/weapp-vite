import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT, SLOT_OWNER_ATTR } from '../constants'

export const group = 'standard'
export const order = 10

export function registerGithubIssuesBuildCase() {
  it('issue #563: applies app.vue template as app shell without app.wxml', async () => {
    await runBuild()

    const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-338/index.wxml'), 'utf-8')
    const pageJson = await fs.readJson(path.join(DIST_ROOT, 'pages/issue-338/index.json')) as {
      usingComponents?: Record<string, string>
    }
    const appShellWxml = await fs.readFile(path.join(DIST_ROOT, '__weapp_vite_app_shell.wxml'), 'utf-8')
    const appShellJson = await fs.readJson(path.join(DIST_ROOT, '__weapp_vite_app_shell.json')) as Record<string, unknown>

    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.wxml'))).toBe(false)
    expect(appShellWxml).toContain('issue-563-app-shell')
    expect(appShellWxml).not.toContain('scoped-slots-default')
    expect(appShellJson).toEqual({
      component: true,
      styleIsolation: 'apply-shared',
    })
    expect(pageWxml).toContain(`<weapp-app-shell ${SLOT_OWNER_ATTR}><weapp-layout-default ${SLOT_OWNER_ATTR}>`)
    expect(pageWxml).toContain('</weapp-layout-default></weapp-app-shell>')
    expect(pageJson.usingComponents).toMatchObject({
      'weapp-app-shell': '/__weapp_vite_app_shell',
      'weapp-layout-default': '/layouts/default',
    })
  })
}
