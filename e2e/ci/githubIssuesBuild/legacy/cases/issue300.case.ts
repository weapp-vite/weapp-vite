import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 83

export function registerGithubIssuesBuildCase() {
  it('issue #300: keeps boolean props available in runtime call-expression bindings', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-300/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-300/index.js')
    const probeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.wxml')
    const probeJsPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.js')
    const strictProbeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.wxml')
    const strictProbeJsPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.js')
    const strictProbeJsonPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.json')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const probeWxml = await fs.readFile(probeWxmlPath, 'utf-8')
    const probeJs = await fs.readFile(probeJsPath, 'utf-8')
    const strictProbeWxml = await fs.readFile(strictProbeWxmlPath, 'utf-8')
    const strictProbeJs = await fs.readFile(strictProbeJsPath, 'utf-8')
    const strictProbeJson = await fs.readFile(strictProbeJsonPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-300 props destructure boolean binding')
    expect(issuePageWxml).toContain('toggle bool:')
    expect(issuePageWxml).toContain('toggle str:')
    expect(issuePageWxml).toContain('sync toggle props in place')
    expect(issuePageWxml).toContain('issue300-toggle-bool')
    expect(issuePageWxml).toContain('issue300-toggle-str')
    expect(issuePageWxml).toContain('issue300-toggle-sync')
    expect(issuePageWxml).toContain('strict-no-props-var')
    expect(issuePageWxml).toContain('primitive-ref-source')
    expect(issuePageWxml).toContain('ref-object-source')
    expect(issuePageWxml).toContain('reactive-object-source')
    expect(issuePageWxml).toContain('case-id="primitive"')
    expect(issuePageWxml).toContain('case-id="ref-object"')
    expect(issuePageWxml).toContain('case-id="reactive-object"')
    expect(issuePageJs).toContain('toggleBool')
    expect(issuePageJs).toContain('toggleStr')
    expect(issuePageJs).toContain('syncTogglePropsInPlace')
    expect(issuePageJs).toContain('_resetE2E')
    expect(issuePageJs).toContain('_runE2E')

    const probeBindTokens = probeWxml.match(/__wv_bind_\d+/g) ?? []
    expect(new Set(probeBindTokens).size).toBeGreaterThanOrEqual(2)
    expect(probeWxml).toMatch(/data-destructured-bool="\{\{__wv_bind_\d+\}\}"/)
    expect(probeWxml).toMatch(/data-props-bool="\{\{__wv_bind_\d+\}\}"/)
    expect(probeWxml).not.toContain('String(bool)')
    expect(probeWxml).not.toContain('String(props.bool)')
    expect(probeJs).toContain('boolTextFromProps')
    expect(probeJs).toContain('boolTextFromDestructured')
    expect(probeJs).toContain('allowNullPropInput: true')
    expect(probeJs).toContain('__wevuPropsDerivedKeys: [')
    expect(probeJs).not.toContain('__wevuProps.props')

    expect(strictProbeWxml).toMatch(/\{\{__wv_bind_\d+\}\}/)
    expect(strictProbeWxml).toMatch(/data-strict-bool="\{\{__wv_bind_\d+\}\}"/)
    expect(strictProbeWxml).toContain('data-strict-str="{{str}}"')
    expect(strictProbeWxml).not.toContain('String(bool)')
    expect(strictProbeJs).toContain('allowNullPropInput: true')
    expect(strictProbeJs).toContain('__wevuPropsDerivedKeys: [')
    expect(strictProbeJs).not.toContain('__wevuProps.props')
    expect(JSON.parse(strictProbeJson)?.styleIsolation).toBe('apply-shared')
  })
}
