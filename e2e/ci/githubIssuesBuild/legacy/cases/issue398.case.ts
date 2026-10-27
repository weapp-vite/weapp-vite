import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT, SLOT_OWNER_ATTR } from '../constants'
import { resolveSharedRuntimeImport } from '../helpers'

export const group = 'standard'
export const order = 65

export function registerGithubIssuesBuildCase() {
  it('issue #398: emits layout and component importers that share the same wevu runtime chunk', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-398/index.js')
    const layoutJsPath = path.join(DIST_ROOT, 'layouts/issue-398-shell.js')
    const navbarJsPath = path.join(DIST_ROOT, 'components/issue-398/BaseNavbar/index.js')
    const footerJsPath = path.join(DIST_ROOT, 'components/issue-398/BaseFooter/index.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-398/index.wxml')

    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const layoutJs = await fs.readFile(layoutJsPath, 'utf-8')
    const navbarJs = await fs.readFile(navbarJsPath, 'utf-8')
    const footerJs = await fs.readFile(footerJsPath, 'utf-8')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageWxml).toContain(`<weapp-layout-issue-398-shell ${SLOT_OWNER_ATTR}>`)
    expect(pageWxml).toContain('{{issue398Title}}')
    expect(pageWxml).toContain('{{issue398PageMarker}}')
    expect(pageWxml).toContain('{{issue398TapLabel}}')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('issue398NavbarLabel')
    expect(pageJs).toContain('issue398FooterLabel')
    expect(layoutJs).not.toContain('../components/issue-398/BaseNavbar/index.vue')
    expect(layoutJs).not.toContain('../components/issue-398/BaseFooter/index.vue')
    expect(navbarJs).toContain('issue-398 navbar')
    expect(navbarJs).toContain('__issue398NavbarMounted')
    expect(navbarJs).toContain('__issue398NavbarLabel')
    expect(footerJs).toContain('issue-398 footer')
    expect(footerJs).toContain('__issue398FooterMounted')
    expect(footerJs).toContain('__issue398FooterLabel')

    const pageSharedRuntimePath = resolveSharedRuntimeImport(pageJsPath, pageJs)
    const layoutSharedRuntimePath = resolveSharedRuntimeImport(layoutJsPath, layoutJs)
    const navbarSharedRuntimePath = resolveSharedRuntimeImport(navbarJsPath, navbarJs)
    const footerSharedRuntimePath = resolveSharedRuntimeImport(footerJsPath, footerJs)

    expect(pageSharedRuntimePath).toBeTruthy()
    expect(layoutSharedRuntimePath).toBeTruthy()
    expect(navbarSharedRuntimePath).toBeTruthy()
    expect(footerSharedRuntimePath).toBeTruthy()
    expect(pageSharedRuntimePath).toBe(layoutSharedRuntimePath)
    expect(pageSharedRuntimePath).toBe(navbarSharedRuntimePath)
    expect(pageSharedRuntimePath).toBe(footerSharedRuntimePath)
    expect(await fs.pathExists(pageSharedRuntimePath!)).toBe(true)
  })
}
