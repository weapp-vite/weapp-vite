import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from './utils/automator'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/github-issues')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)

  await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
    cwd: APP_ROOT,
  })
}

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return stripAutomatorOverlay(await element.wxml())
}

async function readClassName(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }

  return (await element.attribute('class') ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeClassValue(className: string) {
  return className.trim().replace(/\s+/g, ' ')
}

function readFirstClassFromWxmlByToken(wxml: string, token: string) {
  const escapedToken = escapeRegExp(token)
  const pattern = new RegExp(`<[^>]*\\bclass=(['"])([^'\"]*\\b${escapedToken}\\b[^'\"]*)\\1[^>]*>`, 'i')
  const className = pattern.exec(wxml)?.[2] ?? ''
  return normalizeClassValue(className)
}

async function tapControlAndReadClass(page: any, tapSelector: string, classSelector = tapSelector) {
  const controlElement = await page.$(tapSelector)
  if (!controlElement) {
    throw new Error(`Failed to find tap element: ${tapSelector}`)
  }

  const beforeClass = await readClassName(page, classSelector)

  async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
    if (mode === 'tap') {
      await controlElement.tap()
      return
    }
    if (mode === 'trigger') {
      await controlElement.trigger('tap')
      return
    }
    if (mode === 'touch') {
      await controlElement.touchstart()
      await controlElement.touchend()
      return
    }
    await controlElement.dispatchEvent({ eventName: 'tap' })
  }

  for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
    for (let index = 0; index < 2; index += 1) {
      try {
        await fireTapLikeEvent(mode)
      }
      catch {
      }
      await page.waitFor(220)
      const currentClass = await readClassName(page, classSelector)
      if (currentClass !== beforeClass) {
        return currentClass
      }
    }
  }

  return readClassName(page, classSelector)
}

describe.sequential('e2e app: github-issues', () => {
  it('issue #289: compiles split pages with per-page controls and safe class bindings', async () => {
    await runBuild()

    const navPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/index.wxml')
    const navPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/index.js')
    const objectPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/object-literal/index.wxml')
    const objectPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/object-literal/index.js')
    const mapPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/map-class/index.wxml')
    const mapPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/map-class/index.js')
    const rootPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/root-class/index.wxml')
    const rootPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/root-class/index.js')
    const computedPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/computed-class/index.wxml')
    const computedPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/computed-class/index.js')

    const objectLiteralWxmlPath = path.join(DIST_ROOT, 'components/issue-289/ObjectLiteralExample/index.wxml')
    const objectLiteralJsPath = path.join(DIST_ROOT, 'components/issue-289/ObjectLiteralExample/index.js')
    const mapClassWxmlPath = path.join(DIST_ROOT, 'components/issue-289/MapClassExample/index.wxml')
    const mapClassJsPath = path.join(DIST_ROOT, 'components/issue-289/MapClassExample/index.js')
    const rootClassWxmlPath = path.join(DIST_ROOT, 'components/issue-289/RootClassExample/index.wxml')
    const rootClassJsPath = path.join(DIST_ROOT, 'components/issue-289/RootClassExample/index.js')
    const computedClassWxmlPath = path.join(DIST_ROOT, 'components/issue-289/ComputedClassExample/index.wxml')
    const computedClassJsPath = path.join(DIST_ROOT, 'components/issue-289/ComputedClassExample/index.js')

    const navPageWxml = await fs.readFile(navPageWxmlPath, 'utf-8')
    const navPageJs = await fs.readFile(navPageJsPath, 'utf-8')
    const objectPageWxml = await fs.readFile(objectPageWxmlPath, 'utf-8')
    const objectPageJs = await fs.readFile(objectPageJsPath, 'utf-8')
    const mapPageWxml = await fs.readFile(mapPageWxmlPath, 'utf-8')
    const mapPageJs = await fs.readFile(mapPageJsPath, 'utf-8')
    const rootPageWxml = await fs.readFile(rootPageWxmlPath, 'utf-8')
    const rootPageJs = await fs.readFile(rootPageJsPath, 'utf-8')
    const computedPageWxml = await fs.readFile(computedPageWxmlPath, 'utf-8')
    const computedPageJs = await fs.readFile(computedPageJsPath, 'utf-8')

    const objectLiteralWxml = await fs.readFile(objectLiteralWxmlPath, 'utf-8')
    const objectLiteralJs = await fs.readFile(objectLiteralJsPath, 'utf-8')
    const mapClassWxml = await fs.readFile(mapClassWxmlPath, 'utf-8')
    const mapClassJs = await fs.readFile(mapClassJsPath, 'utf-8')
    const rootClassWxml = await fs.readFile(rootClassWxmlPath, 'utf-8')
    const rootClassJs = await fs.readFile(rootClassJsPath, 'utf-8')
    const computedClassWxml = await fs.readFile(computedClassWxmlPath, 'utf-8')
    const computedClassJs = await fs.readFile(computedClassJsPath, 'utf-8')

    expect(navPageWxml).toContain('wx:for="{{sceneLinks}}"')
    expect(navPageWxml).toContain('wx:key="url"')
    expect(navPageWxml).toContain('url="{{item.url}}"')
    expect(navPageJs).toContain('sceneLinks')
    expect(navPageJs).toContain('/pages/issue-289/object-literal/index')
    expect(navPageJs).toContain('/pages/issue-289/map-class/index')
    expect(navPageJs).toContain('/pages/issue-289/root-class/index')
    expect(navPageJs).toContain('/pages/issue-289/computed-class/index')

    expect(objectPageWxml).toContain('<ObjectLiteralExample')
    expect(objectPageWxml).toContain('show-list="{{controlState.showList}}"')
    expect(objectPageWxml).toContain('compact-mode="{{controlState.compactMode}}"')
    expect(objectPageWxml).toContain('active-id="{{activeId}}"')
    expect(objectPageWxml).toContain('bindtap="toggleShowList"')
    expect(objectPageWxml).toContain('bindtap="toggleCompactMode"')
    expect(objectPageWxml).toContain('bindtap="cycleActive"')
    expect(objectPageJs).toContain('controlState')
    expect(objectPageJs).toContain('runE2E')
    expect(objectPageJs).toContain('showListRoundTripWorked')

    expect(mapPageWxml).toContain('<MapClassExample')
    expect(mapPageWxml).toContain('callout-expanded="{{controlState.calloutExpanded}}"')
    expect(mapPageWxml).toContain('show-callout-list="{{controlState.showCalloutList}}"')
    expect(mapPageWxml).toContain('selected-event-idx="{{controlState.selectedIndex}}"')
    expect(mapPageWxml).toContain('bindtap="toggleCalloutExpanded"')
    expect(mapPageWxml).toContain('bindtap="toggleShowCalloutList"')
    expect(mapPageWxml).toContain('bindtap="cycleSelectedEvent"')
    expect(mapPageJs).toContain('controlState')
    expect(mapPageJs).toContain('runE2E')
    expect(mapPageJs).toContain('showCalloutListChanged')

    expect(rootPageWxml).toContain('<RootClassExample')
    expect(rootPageWxml).toContain('show-options="{{controlState.showOptions}}"')
    expect(rootPageWxml).toContain('selected-option-id="{{selectedOptionId}}"')
    expect(rootPageWxml).toContain('bindtap="toggleShowOptions"')
    expect(rootPageWxml).toContain('bindtap="cycleOption"')
    expect(rootPageJs).toContain('controlState')
    expect(rootPageJs).toContain('runE2E')
    expect(rootPageJs).toContain('selectedIndexChanged')

    expect(computedPageWxml).toContain('<ComputedClassExample')
    expect(computedPageWxml).toContain('source-enabled="{{controlState.sourceEnabled}}"')
    expect(computedPageWxml).toContain('show-items="{{controlState.showItems}}"')
    expect(computedPageWxml).toContain('selected-index="{{controlState.selectedIndex}}"')
    expect(computedPageWxml).toContain('bindtap="toggleSourceEnabled"')
    expect(computedPageWxml).toContain('bindtap="toggleShowItems"')
    expect(computedPageWxml).toContain('bindtap="cycleSelected"')
    expect(computedPageJs).toContain('controlState')
    expect(computedPageJs).toContain('runE2E')
    expect(computedPageJs).toContain('showItemsChanged')

    expect(objectLiteralWxml).toContain('root="{{__wv_bind_0}}"')
    expect(objectLiteralWxml).not.toContain('root="{{{')
    expect(objectLiteralWxml).not.toContain('root="{{({')
    expect(objectLiteralWxml).toMatch(/wx:if="\{\{showList\}\}"/)
    expect(objectLiteralWxml).toMatch(/wx:for="\{\{items\}\}"/)
    expect(objectLiteralWxml).toContain('wx:else')

    const objectClassBindingTokens = objectLiteralWxml.match(/__wv_cls_\d+/g) ?? []
    expect(new Set(objectClassBindingTokens).size).toBeGreaterThanOrEqual(2)

    expect(mapClassWxml).toMatch(/wx:for-index="(?:__wv_index_0|index)"/)
    expect(mapClassWxml).toMatch(/__wv_cls_\d+\[(?:__wv_index_0|index)\]/)
    expect(mapClassWxml).toContain('min-scale="{{3}}"')
    expect(mapClassWxml).toContain('max-scale="{{20}}"')
    expect(mapClassWxml).toContain('bindmarkertap="handleMarkerTap"')
    expect(mapClassWxml).toContain('bindregionchange="handleRegionChange"')
    expect(mapClassWxml).toContain('show-compass="{{true}}"')
    expect(mapClassWxml).toContain('enable-zoom="{{true}}"')
    expect(mapClassWxml).toMatch(/wx:for="\{\{events\}\}"/)
    expect(mapClassWxml).toMatch(/wx:for="\{\{mapMetaList\}\}"/)
    expect(mapClassWxml).toMatch(/wx:if="\{\{showCalloutList\}\}"/)

    const mapClassBindingTokens = mapClassWxml.match(/__wv_cls_\d+/g) ?? []
    expect(new Set(mapClassBindingTokens).size).toBeGreaterThanOrEqual(1)

    expect(objectLiteralJs).toContain('__wv_bind_0')
    expect(objectLiteralJs).toMatch(/return\{a:[`'"]aaaa[`'"]\}/)
    expect(objectLiteralJs).toContain('showList')
    expect(objectLiteralJs).toContain('compactMode')
    expect(objectLiteralJs).toContain('activeId')

    expect(mapClassJs).toContain('selectedEventIdx')
    expect(mapClassJs).toContain('isPublic')
    expect(mapClassJs).toContain('includePoints')
    expect(mapClassJs).toContain('polyline')
    expect(mapClassJs).toContain('circles')
    expect(mapClassJs).toContain('calloutExpanded')
    expect(mapClassJs).toContain('showCalloutList')
    expect(mapClassJs).toContain('safeSelectedEventIdx')
    expect(mapClassJs).toContain('mapMetaList')

    expect(rootClassWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)
    expect(rootClassWxml).toMatch(/wx:if="\{\{showOptions\}\}"/)
    expect(rootClassWxml).toMatch(/wx:for="\{\{options\}\}"/)
    expect(rootClassJs).toContain('selectedClassName')
    expect(rootClassJs).toContain('showOptions')
    expect(rootClassJs).toContain('selectedOptionId')

    expect(computedClassWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)
    expect(computedClassWxml).toMatch(/wx:if="\{\{showItems\}\}"/)
    expect(computedClassWxml).toMatch(/wx:for="\{\{items\}\}"/)
    expect(computedClassJs).toContain('computedValue')
    expect(computedClassJs).toContain('sourceEnabled')
    expect(computedClassJs).toContain('showItems')
    expect(computedClassJs).toContain('selectedIndex')
    expect(computedClassJs).toContain('safeSelectedIndex')
    expect(computedClassJs).toContain('computedListClass')
  })

  it('issue #289: updates runtime classes on split pages', async () => {
    await runBuild()

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const objectPage = await miniProgram.reLaunch('/pages/issue-289/object-literal/index')
      if (!objectPage) {
        throw new Error('Failed to launch object-literal page')
      }
      await objectPage.waitFor(500)

      const objectInitialWxml = await readPageWxml(objectPage)
      expect(objectInitialWxml).toContain('object-list-loose')
      expect(objectInitialWxml).not.toContain('object list hidden')

      const objectResult = await objectPage.callMethod('runE2E')
      await objectPage.waitFor(400)
      expect(objectResult?.ok).toBe(true)
      expect(objectResult?.checks?.compactChanged).toBe(true)
      expect(objectResult?.checks?.activeChanged).toBe(true)
      expect(objectResult?.checks?.showListRoundTripWorked).toBe(true)
      expect(objectResult?.checks?.finalListVisible).toBe(true)
      expect(objectResult?.state?.compactMode).toBe(true)
      expect(objectResult?.state?.showList).toBe(true)
      expect(objectResult?.state?.activeIndex).toBe(1)

      const objectUpdatedWxml = await readPageWxml(objectPage)
      expect(objectUpdatedWxml).toContain('object-list-compact')
      expect(objectUpdatedWxml).not.toContain('object-list-loose')
      expect(objectUpdatedWxml).not.toContain('object list hidden')
      expect(objectUpdatedWxml).toContain('激活项：item-1')

      const mapPage = await miniProgram.reLaunch('/pages/issue-289/map-class/index')
      if (!mapPage) {
        throw new Error('Failed to launch map-class page')
      }
      await mapPage.waitFor(500)

      const mapInitialWxml = await readPageWxml(mapPage)
      expect(mapInitialWxml).toContain('issue289-map-toggle-expanded issue289-ctrl-on')
      expect(mapInitialWxml).toContain('issue289-map-toggle-list issue289-ctrl-on')
      expect(mapInitialWxml).toContain('issue289-map-cycle-selected issue289-cycle-1')
      expect(mapInitialWxml).toContain('map-meta-list-open')
      const mapListControlOnClass = await readClassName(mapPage, '.issue289-map-toggle-list')
      const mapExpandedControlOnClass = await readClassName(mapPage, '.issue289-map-toggle-expanded')
      expect(mapListControlOnClass).toContain('issue289-ctrl-on')
      expect(mapExpandedControlOnClass).toContain('issue289-ctrl-on')

      const mapMetaListOnClass = readFirstClassFromWxmlByToken(mapInitialWxml, 'map-meta-list')
      expect(mapMetaListOnClass).toContain('map-meta-list-open')
      expect(mapMetaListOnClass).not.toContain('map-meta-list-closed')

      const mapExpandedControlOffClass = await tapControlAndReadClass(
        mapPage,
        '.issue289-map-switch-expanded',
        '.issue289-map-toggle-expanded',
      )
      expect(mapExpandedControlOffClass).toContain('issue289-ctrl-off')
      expect(mapExpandedControlOffClass).not.toContain('issue289-ctrl-on')

      const mapExpandedOffWxml = await readPageWxml(mapPage)
      expect(mapExpandedOffWxml).toContain('map-meta-list-open')

      const mapListControlOffClass = await tapControlAndReadClass(
        mapPage,
        '.issue289-map-switch-list',
        '.issue289-map-toggle-list',
      )
      expect(mapListControlOffClass).toContain('issue289-ctrl-off')
      expect(mapListControlOffClass).not.toContain('issue289-ctrl-on')

      const mapListOffWxml = await readPageWxml(mapPage)
      const mapMetaListOffClass = readFirstClassFromWxmlByToken(mapListOffWxml, 'map-meta-list')
      expect(mapMetaListOffClass).toContain('map-meta-list-closed')
      expect(mapMetaListOffClass).not.toContain('map-meta-list-open')
      expect(mapListOffWxml).not.toContain('event-chip-expanded')
      expect(mapListOffWxml).toContain('callout hidden')

      const mapListControlOnClassAfter = await tapControlAndReadClass(
        mapPage,
        '.issue289-map-switch-list',
        '.issue289-map-toggle-list',
      )
      expect(mapListControlOnClassAfter).toContain('issue289-ctrl-on')
      expect(mapListControlOnClassAfter).not.toContain('issue289-ctrl-off')

      const mapListOnWxml = await readPageWxml(mapPage)
      const mapMetaListOnClassAfter = readFirstClassFromWxmlByToken(mapListOnWxml, 'map-meta-list')
      expect(mapMetaListOnClassAfter).toContain('map-meta-list-open')
      expect(mapMetaListOnClassAfter).not.toContain('map-meta-list-closed')
      expect(mapListOnWxml).not.toContain('callout hidden')

      const mapExpandedControlOnClassAfter = await tapControlAndReadClass(
        mapPage,
        '.issue289-map-switch-expanded',
        '.issue289-map-toggle-expanded',
      )
      expect(mapExpandedControlOnClassAfter).toContain('issue289-ctrl-on')
      expect(mapExpandedControlOnClassAfter).not.toContain('issue289-ctrl-off')
      const mapExpandedOnWxml = await readPageWxml(mapPage)
      expect(mapExpandedOnWxml).toContain('map-meta-list-open')

      const rootPage = await miniProgram.reLaunch('/pages/issue-289/root-class/index')
      if (!rootPage) {
        throw new Error('Failed to launch root-class page')
      }
      await rootPage.waitFor(500)

      const rootInitialWxml = await readPageWxml(rootPage)
      expect(rootInitialWxml).toContain('root class: aaaa')

      const rootResult = await rootPage.callMethod('runE2E')
      await rootPage.waitFor(400)
      expect(rootResult?.ok).toBe(true)
      expect(rootResult?.checks?.selectedIndexChanged).toBe(true)
      expect(rootResult?.checks?.showOptionsChanged).toBe(true)
      expect(rootResult?.state?.showOptions).toBe(false)
      expect(rootResult?.state?.selectedIndex).toBe(1)

      const rootUpdatedWxml = await readPageWxml(rootPage)
      expect(rootUpdatedWxml).toContain('root class: bbbb')
      expect(rootUpdatedWxml).toContain('options hidden')
      expect(rootUpdatedWxml).toContain('选中类：root-b')

      const computedPage = await miniProgram.reLaunch('/pages/issue-289/computed-class/index')
      if (!computedPage) {
        throw new Error('Failed to launch computed-class page')
      }
      await computedPage.waitFor(500)

      const computedInitialWxml = await readPageWxml(computedPage)
      expect(computedInitialWxml).toContain('issue289-computed-toggle-source issue289-ctrl-on')
      expect(computedInitialWxml).toContain('issue289-computed-toggle-items issue289-ctrl-on')
      expect(computedInitialWxml).toContain('issue289-computed-cycle-selected issue289-cycle-0')

      const computedSourceOnClass = await readClassName(computedPage, '.issue289-computed-toggle-source')
      const computedItemsOnClass = await readClassName(computedPage, '.issue289-computed-toggle-items')
      expect(computedSourceOnClass).toContain('issue289-ctrl-on')
      expect(computedItemsOnClass).toContain('issue289-ctrl-on')
      const computedListOnClass = readFirstClassFromWxmlByToken(computedInitialWxml, 'computed-list')
      expect(computedListOnClass).toContain('computed-list')
      expect(
        computedListOnClass.includes('computed-list-enabled')
        || computedListOnClass.includes('computed-list-disabled'),
      ).toBe(true)

      const computedSourceOffClass = await tapControlAndReadClass(
        computedPage,
        '.issue289-computed-switch-source',
        '.issue289-computed-toggle-source',
      )
      expect(computedSourceOffClass).toContain('issue289-ctrl-off')
      expect(computedSourceOffClass).not.toContain('issue289-ctrl-on')

      const computedSourceOffWxml = await readPageWxml(computedPage)
      const computedListDisabledClass = readFirstClassFromWxmlByToken(computedSourceOffWxml, 'computed-list')
      expect(computedListDisabledClass).toContain('computed-list')
      expect(computedListDisabledClass).not.toBe(computedListOnClass)

      const computedItemsOffClass = await tapControlAndReadClass(
        computedPage,
        '.issue289-computed-switch-items',
        '.issue289-computed-toggle-items',
      )
      expect(computedItemsOffClass).toContain('issue289-ctrl-off')
      expect(computedItemsOffClass).not.toContain('issue289-ctrl-on')

      const computedItemsOffWxml = await readPageWxml(computedPage)
      const computedEmptyClass = readFirstClassFromWxmlByToken(computedItemsOffWxml, 'computed-empty')
      expect(computedEmptyClass).toContain('computed-empty-b')
      expect(computedItemsOffWxml).not.toContain('computed-list-enabled')
      expect(computedItemsOffWxml).not.toContain('computed-list-disabled')

      const computedItemsOnClassAfter = await tapControlAndReadClass(
        computedPage,
        '.issue289-computed-switch-items',
        '.issue289-computed-toggle-items',
      )
      expect(computedItemsOnClassAfter).toContain('issue289-ctrl-on')
      expect(computedItemsOnClassAfter).not.toContain('issue289-ctrl-off')

      const computedItemsOnWxml = await readPageWxml(computedPage)
      const computedListDisabledClassAfter = readFirstClassFromWxmlByToken(computedItemsOnWxml, 'computed-list')
      expect(computedListDisabledClassAfter).toBe(computedListDisabledClass)

      const computedSourceOnClassAfter = await tapControlAndReadClass(
        computedPage,
        '.issue289-computed-switch-source',
        '.issue289-computed-toggle-source',
      )
      expect(computedSourceOnClassAfter).toContain('issue289-ctrl-on')
      expect(computedSourceOnClassAfter).not.toContain('issue289-ctrl-off')

      const computedSourceOnWxml = await readPageWxml(computedPage)
      const computedListEnabledClassAfter = readFirstClassFromWxmlByToken(computedSourceOnWxml, 'computed-list')
      expect(computedListEnabledClassAfter).toBe(computedListOnClass)
    }
    finally {
      await miniProgram.close()
    }
  })

  it('issue #294: injects share lifecycle options for script-setup page hooks', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-294/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-294/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-294/index.json')
    const issuePageJson = await fs.readFile(issuePageJsonPath, 'utf-8')
    const commonJsPath = path.join(DIST_ROOT, 'common.js')
    const commonJs = await fs.readFile(commonJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-294 share hooks')
    expect(issuePageJs).toContain('enableOnShareAppMessage:!0')
    expect(issuePageJs).toContain('enableOnShareTimeline:!0')
    expect(issuePageJs).not.toMatch(/onShareAppMessage(?:\(\)|:function\(\))\{return\{\}\}/)
    expect(issuePageJs).not.toMatch(/onShareTimeline(?:\(\)|:function\(\))\{return\{\}\}/)
    expect(issuePageJs).toContain('issue-294-share-')
    expect(issuePageJs).toContain('issue-294-timeline-')
    expect(issuePageJson).not.toContain('"enableShareAppMessage"')
    expect(issuePageJson).not.toContain('"enableShareTimeline"')
    expect(commonJs).toContain('showShareMenu')
    expect(commonJs).not.toContain('?.')
  })
})
