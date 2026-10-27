import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { findWevuRuntimeChunk } from '../../../../utils/wevu-vendor'
import { findMarkupElements } from '../../markup'
import { runIssue558AugmentedBuild } from '../builders/issue558AugmentedBuild'
import { DIST_ROOT } from '../constants'
import { scanFiles, stripGeneratedScopeAttrs } from '../helpers'

export const group = 'issue558'
export const order = 53

export function registerGithubIssuesBuildCase() {
  it('issue #558: augmented scoped slot runtime bindings read owner proxy', async () => {
    await runIssue558AugmentedBuild()

    const files = await scanFiles(DIST_ROOT)
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-558/index.wxml')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-558/index.json')
    const cellWxmlPath = path.join(DIST_ROOT, 'components/issue-558/Cell/index.wxml')
    const defaultScopedCellWxmlPath = path.join(DIST_ROOT, 'components/issue-558/DefaultScopedCell/index.wxml')
    const listScopedCellWxmlPath = path.join(DIST_ROOT, 'components/issue-558/ListScopedCell/index.wxml')
    const namedSlotCardWxmlPath = path.join(DIST_ROOT, 'components/issue-558/NamedSlotCard/index.wxml')
    const namedSlotCardJsPath = path.join(DIST_ROOT, 'components/issue-558/NamedSlotCard/index.js')
    const nestedSlotCellWxmlPath = path.join(DIST_ROOT, 'components/issue-558/Issue558NestedSlotCell/index.wxml')
    const nestedSlotGroupWxmlPath = path.join(DIST_ROOT, 'components/issue-558/Issue558NestedSlotGroup/index.wxml')
    const scopedSlotFiles = files
      .filter(file => file.startsWith('pages/issue-558/index.__scoped-slot-') && file.endsWith('.wxml'))
      .sort()
    const scopedSlotJsFiles = files
      .filter(file => file.startsWith('pages/issue-558/index.__scoped-slot-') && file.endsWith('.js'))
      .sort()
    const scopedSlotJsonFiles = files
      .filter(file => file.startsWith('pages/issue-558/index.__scoped-slot-') && file.endsWith('.json'))
      .sort()
    const runtime = await findWevuRuntimeChunk(
      DIST_ROOT,
      code => code.includes('__wvOwnerProxy'),
      'issue #558 owner proxy runtime',
    )

    const pageWxml = stripGeneratedScopeAttrs(await fs.readFile(pageWxmlPath, 'utf-8'))
    const pageJson = await fs.readJson(pageJsonPath) as { usingComponents?: Record<string, string> }
    const scopedSlotWxml = stripGeneratedScopeAttrs((await Promise.all(scopedSlotFiles.map(file => fs.readFile(path.join(DIST_ROOT, file), 'utf-8')))).join('\n'))
    const scopedSlotJs = (await Promise.all(scopedSlotJsFiles.map(file => fs.readFile(path.join(DIST_ROOT, file), 'utf-8')))).join('\n')
    const scopedSlotJson = (await Promise.all(scopedSlotJsonFiles.map(file => fs.readFile(path.join(DIST_ROOT, file), 'utf-8')))).join('\n')
    const cellWxml = await fs.readFile(cellWxmlPath, 'utf-8')
    const defaultScopedCellWxml = await fs.readFile(defaultScopedCellWxmlPath, 'utf-8')
    const listScopedCellWxml = await fs.readFile(listScopedCellWxmlPath, 'utf-8')
    const namedSlotCardWxml = await fs.readFile(namedSlotCardWxmlPath, 'utf-8')
    const namedSlotCardJs = await fs.readFile(namedSlotCardJsPath, 'utf-8')
    const nestedSlotCellWxml = await fs.readFile(nestedSlotCellWxmlPath, 'utf-8')
    const nestedSlotGroupWxml = await fs.readFile(nestedSlotGroupWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue-558 augmented slot computed binding')
    expect(pageWxml).toContain('generic:scoped-slots-default=')
    expect(pageWxml).toContain('generic:scoped-slots-header=')
    expect(pageWxml).toContain('generic:scoped-slots-footer=')
    expect(pageJson.usingComponents).toMatchObject({
      'cell': '/components/issue-558/Cell/index',
      'default-scoped-cell': '/components/issue-558/DefaultScopedCell/index',
      'issue558-nested-slot-cell': '/components/issue-558/Issue558NestedSlotCell/index',
      'issue558-nested-slot-group': '/components/issue-558/Issue558NestedSlotGroup/index',
      'issue-558-render-probe': '/components/issue-558/Issue558RenderProbe/index',
      'list-scoped-cell': '/components/issue-558/ListScopedCell/index',
      'named-slot-card': '/components/issue-558/NamedSlotCard/index',
    })
    expect(Object.values(pageJson.usingComponents ?? {}).some(value => value.startsWith('/pages/issue-558/index.__scoped-slot-'))).toBe(true)
    expect(scopedSlotFiles.length).toBeGreaterThanOrEqual(5)
    expect(scopedSlotJsFiles.length).toBe(scopedSlotFiles.length)
    expect(scopedSlotJsonFiles.length).toBe(scopedSlotFiles.length)
    expect(findMarkupElements(pageWxml, 'issue-558-render-probe').map(node => node.attribs)).toContainEqual(expect.objectContaining({
      'case-name': 'plainDefault',
      'value': expect.stringMatching(/^\{\{__wv_bind_\d+\}\}$/),
    }))
    expect(scopedSlotWxml).not.toContain('case-name="plainDefault"')
    expect(scopedSlotJson).toContain('/components/issue-558/Issue558RenderProbe/index')
    for (const caseName of [
      'namedHeader',
      'explicitDefault',
      'namedScopedFooter',
      'defaultScoped',
      'listScoped',
      'nestedOuter',
      'nestedDefault',
    ]) {
      expect(findMarkupElements(scopedSlotWxml, 'issue-558-render-probe').map(node => node.attribs)).toContainEqual(expect.objectContaining({
        'case-name': caseName,
        'value': expect.stringMatching(/^\{\{__wv_bind_\d+\}\}$/),
      }))
    }
    expect(scopedSlotJs).toContain('__wvOwnerProxy')
    expect(scopedSlotJs).toContain('.func')
    expect(scopedSlotJs).toContain('.text')
    expect(scopedSlotJs).toContain('.headerText')
    expect(scopedSlotJs).toContain('.defaultText')
    expect(scopedSlotJs).toContain('.nestedText')
    expect(scopedSlotJs).toContain('__wvSlotPropsData')
    expect(scopedSlotJs).toContain('.suffix')
    expect(scopedSlotJs).toContain('.label')
    expect(scopedSlotJs).toContain('.index')
    expect(scopedSlotJs).not.toContain('__wvOwner.func')
    expect(cellWxml).toContain('<slot />')
    expect(cellWxml).not.toContain('<scoped-slots-default')
    expect(defaultScopedCellWxml).toContain('__wvSlotProps="{{[\'label\',label,\'count\',count]}}"')
    expect(listScopedCellWxml).toContain('wx:for="{{rows}}"')
    expect(listScopedCellWxml).toContain('__wvSlotScope="{{__wvSlotScope}}"')
    expect(namedSlotCardWxml).toContain('<slot name="header" />')
    expect(namedSlotCardWxml).toContain('<scoped-slots-header')
    expect(namedSlotCardWxml).toContain('<scoped-slots-default')
    expect(namedSlotCardWxml).toContain('<scoped-slots-footer')
    expect(namedSlotCardJs).toContain('properties')
    expect(namedSlotCardJs).toContain('__wvSlotOwnerId')
    expect(nestedSlotCellWxml).not.toContain('<scoped-slots-default')
    expect(nestedSlotGroupWxml).toContain('<slot />')
    expect(nestedSlotGroupWxml).toContain('<scoped-slots-default')
    expect(runtime.code).toContain('__wvOwnerProxy')
  })
}
