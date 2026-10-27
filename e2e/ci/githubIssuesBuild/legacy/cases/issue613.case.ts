import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'standard'
export const order = 46

export function registerGithubIssuesBuildCase() {
  it('issue #613: wraps forwarded slot outlets inside plain named slot content', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-613/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-613/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-613/Issue613Card/index.wxml')
    const forwarderWxmlPath = path.join(DIST_ROOT, 'components/issue-613/Issue613ViewForwarder/index.wxml')
    const forwarderJsonPath = path.join(DIST_ROOT, 'components/issue-613/Issue613ViewForwarder/index.json')
    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    const wrapperWxmlPath = path.join(DIST_ROOT, 'weapp_vite_internal/slot-wrapper/index.wxml')
    const wrapperJsonPath = path.join(DIST_ROOT, 'weapp_vite_internal/slot-wrapper/index.json')
    const wrapperJsPath = path.join(DIST_ROOT, 'weapp_vite_internal/slot-wrapper/index.js')
    const legacyForwarderWxmlPath = path.join(DIST_ROOT, 'components/issue-613/Issue613LegacyViewForwarder/index.wxml')
    const legacyForwarderJsonPath = path.join(DIST_ROOT, 'components/issue-613/Issue613LegacyViewForwarder/index.json')
    const blockForwarderWxmlPath = path.join(DIST_ROOT, 'components/issue-613/block-forwarder/index.wxml')
    const pageWxml = stripGeneratedScopeAttrs(await fs.readFile(pageWxmlPath, 'utf-8'))
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')
    const forwarderWxml = await fs.readFile(forwarderWxmlPath, 'utf-8')
    const appJson = await fs.readJSON(appJsonPath) as { usingComponents?: Record<string, string> }
    const forwarderJson = await fs.readJSON(forwarderJsonPath) as { usingComponents?: Record<string, string> }
    const wrapperWxml = await fs.readFile(wrapperWxmlPath, 'utf-8')
    const wrapperJson = await fs.readJSON(wrapperJsonPath) as { component?: boolean }
    const wrapperJs = await fs.readFile(wrapperJsPath, 'utf-8')
    const legacyForwarderWxml = await fs.readFile(legacyForwarderWxmlPath, 'utf-8')
    const legacyForwarderJson = await fs.readJSON(legacyForwarderJsonPath) as { usingComponents?: Record<string, string> }
    const blockForwarderWxml = await fs.readFile(blockForwarderWxmlPath, 'utf-8')

    expect(pageWxml).toContain('<issue613-card data-issue613-case="compiled-fragment"')
    expect(pageWxml).toContain('<weapp-slot-wrapper slot="header"><slot /></weapp-slot-wrapper>')
    expect(pageWxml).not.toContain('<slot slot="header"')
    expect(pageWxml).toContain('issue613-block-forwarder')
    expect(forwarderWxml).toContain('<issue613-card vue-slots="{{ {header:true,footer:true} }}"')
    expect(forwarderWxml).not.toContain('vue-slots="{{{')
    expect(forwarderWxml).not.toContain('vue-slots="{{ {[')
    expect(forwarderWxml).toContain('<weapp-slot-wrapper slot="header"><slot /></weapp-slot-wrapper>')
    expect(forwarderWxml).toContain('<weapp-slot-wrapper slot="footer"><slot name="footer" /></weapp-slot-wrapper>')
    expect(appJson.usingComponents?.['weapp-slot-wrapper']).toBeUndefined()
    expect(forwarderJson.usingComponents?.['weapp-slot-wrapper']).toBe('/weapp_vite_internal/slot-wrapper/index')
    expect(wrapperWxml).toBe('<slot></slot>')
    expect(wrapperJson.component).toBe(true)
    expect(wrapperJs).toContain('virtualHost:true')
    expect(wrapperJs).toContain('multipleSlots:true')
    expect(legacyForwarderWxml).toContain('<view slot="header"><slot /></view>')
    expect(legacyForwarderJson.usingComponents?.['weapp-slot-wrapper']).toBeUndefined()
    expect(forwarderWxml).not.toContain('<slot slot="header"')
    expect(forwarderWxml).not.toContain('<slot slot="footer"')
    expect(forwarderWxml).not.toContain('slot-wrapper=')
    expect(forwarderWxml).not.toContain('slot-wrapper-footer=')
    expect(blockForwarderWxml).toContain('<block slot="header">')
    expect(blockForwarderWxml).toContain('<slot></slot>')
    expect(pageJs).toContain('_runE2E')
    expect(componentWxml).toContain('<slot name="header" />')
    expect(componentWxml).toContain('<slot name="footer" />')
  })
}
