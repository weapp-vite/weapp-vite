import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: APP_ROOT,
    label: 'ide:github-issues',
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

function expectPropsProbeCase(
  wxml: string,
  options: { caseId: string, boolText: 'true' | 'false', strText: string },
) {
  const { caseId, boolText, strText } = options
  const casePattern = escapeRegExp(caseId)
  const boolPattern = escapeRegExp(boolText)
  const strPattern = escapeRegExp(strText)

  const destructuredPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-probe-destructured[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-destructured-bool="${boolPattern}")(?=[^>]*data-destructured-str="${strPattern}")[^>]*>`,
  )
  const propsPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-probe-props[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-props-bool="${boolPattern}")(?=[^>]*data-props-bool-raw="${boolPattern}")(?=[^>]*data-props-str="${strPattern}")[^>]*>`,
  )
  const strictPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-strict-probe[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-strict-bool="${boolPattern}")(?=[^>]*data-strict-bool-raw="${boolPattern}")(?=[^>]*data-strict-str="${strPattern}")[^>]*>`,
  )

  expect(wxml).toMatch(destructuredPattern)
  expect(wxml).toMatch(propsPattern)
  expect(wxml).toMatch(strictPattern)
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

async function tapElement(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find tap element: ${selector}`)
  }

  async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
    if (mode === 'tap') {
      await element.tap()
      return
    }
    if (mode === 'trigger') {
      await element.trigger('tap')
      return
    }
    if (mode === 'touch') {
      await element.touchstart()
      await element.touchend()
      return
    }
    await element.dispatchEvent({ eventName: 'tap' })
  }

  let lastError: unknown
  for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
    try {
      await fireTapLikeEvent(mode)
      await page.waitFor(240)
      return
    }
    catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to tap element: ${selector}`)
}

describe.sequential('e2e app: github-issues', () => {
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

  it('issue #297: compiles and renders complex call expressions', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 complex call expressions')
    expect(issuePageWxml).toContain('Case A · v-bind 调用表达式')
    expect(issuePageWxml).toContain('Case B · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case C · 多参数调用（含激活项）')
    expect(issuePageWxml).toContain('Case A(v-bind):')
    expect(issuePageWxml).toContain('Case B(v-if/v-for):')
    expect(issuePageWxml).toContain('Case C(多参数):')
    expect(issuePageWxml).toContain('新增列表项')
    expect(issuePageWxml).toContain('重置列表')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-title="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-hello="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/\{\{__wv_bind_\d+\[[^\]]+\]\}\}/)
    expect(issuePageWxml).not.toContain('sayHello(')
    const bindTokens = issuePageWxml.match(/__wv_bind_\d+/g) ?? []
    expect(new Set(bindTokens).size).toBeGreaterThanOrEqual(5)

    expect(issuePageJs).toMatch(/sayHello\)\(1,/)
    expect(issuePageJs).toContain('dasd')
    expect(issuePageJs).toContain('this.sayHello')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-297/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-297 page')
      }
      await issuePage.waitFor(500)
      const initialRenderedWxml = await readPageWxml(issuePage)
      expect(initialRenderedWxml).toContain('Hello-1-root-dasd')
      expect(initialRenderedWxml).toContain('Hello-1-Alpha-dasd')
      expect(initialRenderedWxml).toContain('Hello-1-Beta-dasd')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.root).toBe('Hello-1-root-dasd')
      expect(runtimeResult?.rendered).toEqual([
        'Hello-1-Alpha-dasd',
        'Hello-1-Beta-dasd',
      ])
    }
    finally {
      await miniProgram.close()
    }
  })

  it('issue #297: setup method call variants remain stable across expression contexts', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 setup method call variants')
    expect(issuePageWxml).toContain('Case A · 插值调用 + 同级静态文本 + 同级元素')
    expect(issuePageWxml).toContain('Case B · v-bind 多参数调用')
    expect(issuePageWxml).toContain('Case C · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case D · 成员调用 / 模板字符串 / 三元表达式')
    expect(issuePageWxml).toContain('Case E · 可选调用 + 空值兜底')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-inline="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-multi="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-label="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-loop="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-member="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-template="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-ternary="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-wrap="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-optional="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).not.toContain('getCase()')
    expect(issuePageWxml).not.toContain('sayCase(')
    expect(issuePageWxml).not.toContain('getOptionalInvoker?.(')

    expect(issuePageJs).toContain('this.getCase')
    expect(issuePageJs).toContain('this.sayCase')
    expect(issuePageJs).toContain('this.getRows')
    expect(issuePageJs).toContain('this.getOptionalInvoker')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-297-setup-method-calls/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-297-setup-method-calls page')
      }
      await issuePage.waitFor(500)

      const initialRenderedWxml = await readPageWxml(issuePage)
      expect(initialRenderedWxml).toContain('123')
      expect(initialRenderedWxml).toContain('11')
      expect(initialRenderedWxml).toContain('bind-Alpha-dasd')
      expect(initialRenderedWxml).toContain('data-loop="loop-Alpha-tail"')
      expect(initialRenderedWxml).toContain('data-member="MEMBER-ALPHA-TAIL"')
      expect(initialRenderedWxml).toContain('data-template="P-123"')
      expect(initialRenderedWxml).toContain('data-ternary="ternary-row-0-dasd"')
      expect(initialRenderedWxml).toContain('data-wrap="[wrap-row-0-tail]"')
      expect(initialRenderedWxml).toContain('data-optional="Maybe-row-0"')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.inlineValue).toBe('123')
      expect(runtimeResult?.bindValue).toBe('bind-Alpha-dasd')
      expect(runtimeResult?.loopValues).toEqual([
        'loop-Alpha-tail',
        'loop-Beta-tail',
      ])
      expect(runtimeResult?.templateLiteralValue).toBe('P-123')
      expect(runtimeResult?.memberValue).toBe('MEMBER-ALPHA-TAIL')
      expect(runtimeResult?.ternaryValue).toBe('ternary-row-0-dasd')
      expect(runtimeResult?.optionalValue).toBe('Maybe-row-0')

      await issuePage.callMethod('toggleOptionalInvoker')
      await issuePage.waitFor(300)
      const optionalDisabledWxml = await readPageWxml(issuePage)
      expect(optionalDisabledWxml).toContain('data-optional="none"')
    }
    finally {
      await miniProgram.close()
    }
  })

  it('issue #302: updates v-for class bindings with active state changes', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-302/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-302/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-302 v-for class binding update')
    expect(issuePageWxml).toContain('active: {{active}}')
    expect(issuePageWxml).toContain('wx:for="{{tabs}}"')
    expect(issuePageWxml).toMatch(/class="\{\{__wv_cls_\d+\[(?:__wv_index_0|index)\]\}\}"/)
    expect(issuePageJs).toContain('setActive')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-302/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-302 page')
      }
      await issuePage.waitFor(500)

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.active).toBe('a')
      expect(await issuePage.data('active')).toBe('a')
      expect(await issuePage.data('__wv_cls_0')).toEqual([
        'issue302-item issue302-item-a issue302-item-active',
        'issue302-item issue302-item-b issue302-item-inactive',
        'issue302-item issue302-item-c issue302-item-inactive',
      ])
      expect(await readClassName(issuePage, '.issue302-item-a')).toContain('issue302-item-active')
      expect(await readClassName(issuePage, '.issue302-item-b')).toContain('issue302-item-inactive')
      expect(await readClassName(issuePage, '.issue302-item-c')).toContain('issue302-item-inactive')

      await issuePage.callMethod('setActive', 'b')
      await issuePage.waitFor(240)
      const switchedToBRuntime = await issuePage.callMethod('_runE2E')
      expect(switchedToBRuntime?.ok).toBe(true)
      expect(switchedToBRuntime?.active).toBe('b')
      expect(await issuePage.data('active')).toBe('b')
      expect(await issuePage.data('__wv_cls_0')).toEqual([
        'issue302-item issue302-item-a issue302-item-inactive',
        'issue302-item issue302-item-b issue302-item-active',
        'issue302-item issue302-item-c issue302-item-inactive',
      ])
      expect(await readClassName(issuePage, '.issue302-item-a')).toContain('issue302-item-inactive')
      expect(await readClassName(issuePage, '.issue302-item-b')).toContain('issue302-item-active')
      expect(await readClassName(issuePage, '.issue302-item-c')).toContain('issue302-item-inactive')

      await issuePage.callMethod('setActive', 'c')
      await issuePage.waitFor(240)
      const switchedToCRuntime = await issuePage.callMethod('_runE2E')
      expect(switchedToCRuntime?.ok).toBe(true)
      expect(switchedToCRuntime?.active).toBe('c')
      expect(await issuePage.data('active')).toBe('c')
      expect(await issuePage.data('__wv_cls_0')).toEqual([
        'issue302-item issue302-item-a issue302-item-inactive',
        'issue302-item issue302-item-b issue302-item-inactive',
        'issue302-item issue302-item-c issue302-item-active',
      ])
      expect(await readClassName(issuePage, '.issue302-item-a')).toContain('issue302-item-inactive')
      expect(await readClassName(issuePage, '.issue302-item-b')).toContain('issue302-item-inactive')
      expect(await readClassName(issuePage, '.issue302-item-c')).toContain('issue302-item-active')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.active).toBe('c')
    }
    finally {
      await miniProgram.close()
    }
  })

  it('issue #300: renders destructured boolean props in runtime call-expression bindings', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-300/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-300/index.js')
    const probeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.wxml')
    const probeJsPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.js')
    const strictProbeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.wxml')
    const strictProbeJsPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const probeWxml = await fs.readFile(probeWxmlPath, 'utf-8')
    const probeJs = await fs.readFile(probeJsPath, 'utf-8')
    const strictProbeWxml = await fs.readFile(strictProbeWxmlPath, 'utf-8')
    const strictProbeJs = await fs.readFile(strictProbeJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-300 props destructure boolean binding')
    expect(issuePageWxml).toContain('toggle str:')
    expect(issuePageWxml).toContain('sync toggle props in place')
    expect(issuePageWxml).toContain('strict-no-props-var')
    expect(issuePageJs).toContain('toggleBool')
    expect(issuePageJs).toContain('toggleStr')
    expect(issuePageJs).toContain('syncTogglePropsInPlace')
    expect(issuePageJs).toContain('_resetE2E')
    expect(issuePageJs).toContain('_runE2E')
    expect(probeWxml).toContain('{{__wv_bind_0}}')
    expect(probeWxml).toContain('{{__wv_bind_1}}')
    expect(probeJs).toContain('__wevuProps.bool')
    expect(probeJs).toContain('Object.prototype.hasOwnProperty.call(this.$state,`bool`)')
    expect(probeJs).not.toContain('__wevuProps.props')
    expect(strictProbeWxml).toContain('{{__wv_bind_0}}')
    expect(strictProbeJs).toContain('__wevuProps.bool')
    expect(strictProbeJs).toContain('Object.prototype.hasOwnProperty.call(this.$state,`bool`)')
    expect(strictProbeJs).not.toContain('__wevuProps.props')

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-300/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-300 page')
      }
      await issuePage.waitFor(500)
      const resetResult = await issuePage.callMethod('_resetE2E')
      expect(resetResult?.ok).toBe(true)
      await issuePage.waitFor(300)

      const initialRenderedWxml = await readPageWxml(issuePage)
      expect(initialRenderedWxml).toContain('toggle bool: true')
      expectPropsProbeCase(initialRenderedWxml, { caseId: 'primitive', boolText: 'true', strText: 'Hello' })
      expectPropsProbeCase(initialRenderedWxml, { caseId: 'ref-object', boolText: 'true', strText: 'RefHello' })
      expectPropsProbeCase(initialRenderedWxml, { caseId: 'reactive-object', boolText: 'true', strText: 'ReactiveHello' })
      expect(initialRenderedWxml).not.toContain('data-strict-bool="undefined"')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.str).toBe('Hello')
      expect(runtimeResult?.bool).toBe(true)
      expect(runtimeResult?.boolText).toBe('true')
      expect(runtimeResult?.refObjectStr).toBe('RefHello')
      expect(runtimeResult?.refObjectBool).toBe(true)
      expect(runtimeResult?.reactiveObjectStr).toBe('ReactiveHello')
      expect(runtimeResult?.reactiveObjectBool).toBe(true)

      await tapElement(issuePage, '.issue300-toggle-bool')

      const toggledBoolWxml = await readPageWxml(issuePage)
      expect(toggledBoolWxml).toContain('toggle bool: false')
      expectPropsProbeCase(toggledBoolWxml, { caseId: 'primitive', boolText: 'false', strText: 'Hello' })
      expectPropsProbeCase(toggledBoolWxml, { caseId: 'ref-object', boolText: 'false', strText: 'RefHello' })
      expectPropsProbeCase(toggledBoolWxml, { caseId: 'reactive-object', boolText: 'false', strText: 'ReactiveHello' })
      expect(toggledBoolWxml).not.toContain('data-strict-bool="undefined"')

      await tapElement(issuePage, '.issue300-toggle-str')

      const toggledStrWxml = await readPageWxml(issuePage)
      expect(toggledStrWxml).toContain('toggle str: World')
      expectPropsProbeCase(toggledStrWxml, { caseId: 'primitive', boolText: 'false', strText: 'World' })
      expectPropsProbeCase(toggledStrWxml, { caseId: 'ref-object', boolText: 'false', strText: 'RefWorld' })
      expectPropsProbeCase(toggledStrWxml, { caseId: 'reactive-object', boolText: 'false', strText: 'ReactiveWorld' })
      expect(toggledStrWxml).not.toContain('data-strict-bool="undefined"')

      await tapElement(issuePage, '.issue300-toggle-sync')

      const syncedWxml = await readPageWxml(issuePage)
      expect(syncedWxml).toContain('toggle bool: true')
      expect(syncedWxml).toContain('toggle str: Hello')
      expectPropsProbeCase(syncedWxml, { caseId: 'primitive', boolText: 'true', strText: 'Hello' })
      expectPropsProbeCase(syncedWxml, { caseId: 'ref-object', boolText: 'true', strText: 'RefHello' })
      expectPropsProbeCase(syncedWxml, { caseId: 'reactive-object', boolText: 'true', strText: 'ReactiveHello' })
      expect(syncedWxml).not.toContain('data-strict-bool="undefined"')
    }
    finally {
      await miniProgram.close()
    }
  })
})
