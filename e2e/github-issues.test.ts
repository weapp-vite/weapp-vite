import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/github-issues')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

describe.sequential('e2e app: github-issues', () => {
  it('issue #289: compiles object literal and class expression bindings safely', async () => {
    await fs.remove(DIST_ROOT)

    await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      stdio: 'inherit',
      cwd: APP_ROOT,
    })

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/index.wxml')
    const objectLiteralWxmlPath = path.join(DIST_ROOT, 'components/issue-289/ObjectLiteralExample/index.wxml')
    const objectLiteralJsPath = path.join(DIST_ROOT, 'components/issue-289/ObjectLiteralExample/index.js')
    const mapClassWxmlPath = path.join(DIST_ROOT, 'components/issue-289/MapClassExample/index.wxml')
    const mapClassJsPath = path.join(DIST_ROOT, 'components/issue-289/MapClassExample/index.js')
    const rootClassWxmlPath = path.join(DIST_ROOT, 'components/issue-289/RootClassExample/index.wxml')
    const computedClassWxmlPath = path.join(DIST_ROOT, 'components/issue-289/ComputedClassExample/index.wxml')
    const computedClassJsPath = path.join(DIST_ROOT, 'components/issue-289/ComputedClassExample/index.js')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const objectLiteralWxml = await fs.readFile(objectLiteralWxmlPath, 'utf-8')
    const objectLiteralJs = await fs.readFile(objectLiteralJsPath, 'utf-8')
    const mapClassWxml = await fs.readFile(mapClassWxmlPath, 'utf-8')
    const mapClassJs = await fs.readFile(mapClassJsPath, 'utf-8')
    const rootClassWxml = await fs.readFile(rootClassWxmlPath, 'utf-8')
    const computedClassWxml = await fs.readFile(computedClassWxmlPath, 'utf-8')
    const computedClassJs = await fs.readFile(computedClassJsPath, 'utf-8')

    expect(pageWxml).toContain('<ObjectLiteralExample />')
    expect(pageWxml).toContain('<MapClassExample />')
    expect(pageWxml).toContain('<RootClassExample />')
    expect(pageWxml).toContain('<ComputedClassExample />')

    expect(objectLiteralWxml).toContain('root="{{__wv_bind_0}}"')
    expect(objectLiteralWxml).not.toContain('root="{{{')
    expect(objectLiteralWxml).not.toContain('root="{{({')

    expect(mapClassWxml).toMatch(/wx:for-index="(?:__wv_index_0|index)"/)
    expect(mapClassWxml).toMatch(/__wv_cls_\d+\[(?:__wv_index_0|index)\]/)
    expect(mapClassWxml).toContain('min-scale="{{3}}"')
    expect(mapClassWxml).toContain('max-scale="{{20}}"')
    expect(mapClassWxml).toContain('bindmarkertap="handleMarkerTap"')
    expect(mapClassWxml).toContain('bindregionchange="handleRegionChange"')
    expect(mapClassWxml).toContain('show-compass="{{true}}"')
    expect(mapClassWxml).toContain('enable-zoom="{{true}}"')

    const classBindingTokens = mapClassWxml.match(/__wv_cls_\d+/g) ?? []
    expect(new Set(classBindingTokens).size).toBeGreaterThanOrEqual(1)

    expect(objectLiteralJs).toContain('__wv_bind_0')
    expect(objectLiteralJs).toMatch(/return\{a:[`'"]aaaa[`'"]\}/)

    expect(mapClassJs).toContain('selectedEventIdx')
    expect(mapClassJs).toContain('isPublic')
    expect(mapClassJs).toContain('includePoints')
    expect(mapClassJs).toContain('polyline')
    expect(mapClassJs).toContain('circles')

    expect(rootClassWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)

    expect(computedClassWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)
    expect(computedClassJs).toContain('computedValue')
    expect(computedClassJs).toMatch(/[`'"]a[`'"]:[`'"]b[`'"]/)
  })

  it('issue #294: injects share lifecycle options for script-setup page hooks', async () => {
    await fs.remove(DIST_ROOT)

    await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      stdio: 'inherit',
      cwd: APP_ROOT,
    })

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-294/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-294/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-294 share hooks')
    expect(issuePageJs).toContain('enableOnShareAppMessage:!0')
    expect(issuePageJs).toContain('enableOnShareTimeline:!0')
    expect(issuePageJs).toContain('issue-294-share-')
    expect(issuePageJs).toContain('issue-294-timeline-')
  })
})
